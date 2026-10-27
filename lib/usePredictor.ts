"use client";

// React hook that connects the drawing canvas to the model.
//
// It loads the model, and every time the drawing changes it runs a prediction,
// but never more than once every PREDICT_INTERVAL_MS while drawing. Every
// stroke end (pen lift) is always predicted, in order, and saved in the
// confidence timeline. Used by the free draw mode and the challenge mode.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLabels } from "./labels";
import { loadModel, predict, topK } from "./model";
import { preprocess } from "./preprocess";
import { recordStroke, truncateTimeline, type Timeline } from "./timeline";
import type { ModelStatus, ModelView, Prediction, Stroke } from "./types";

/** Minimum time between two predictions while the user is drawing. */
const PREDICT_INTERVAL_MS = 150;

/** How many guesses to show. */
const TOP_K = 5;

/** Why the drawing changed. Sent by DrawingCanvas. */
export type ChangeReason = "draw" | "strokeEnd" | "undo" | "clear";

/** One prediction waiting to run: a copy of the strokes at that moment. */
interface Job {
  strokes: Stroke[];
  reason: ChangeReason;
}

export interface Predictor {
  status: ModelStatus;
  error: string | null;
  labels: string[];
  /** Top guesses for the current drawing, most likely first. Empty if blank. */
  predictions: Prediction[];
  /** What the model saw and said in the latest prediction (any reason). */
  latest: ModelView | null;
  /** The latest prediction made at a pen lift or undo (not mid-stroke). */
  lastFinal: ModelView | null;
  /** Probabilities after each finished stroke. */
  timeline: Timeline;
  /** Call this whenever the drawing changes. */
  update: (strokes: readonly Stroke[], reason: ChangeReason) => void;
  /** Forget everything about the current drawing. */
  reset: () => void;
  /** Try loading the model again after an error. */
  retry: () => void;
}

/** Copies the strokes, so later drawing does not change a waiting job. */
function snapshot(strokes: readonly Stroke[]): Stroke[] {
  return strokes.map((s) => ({ width: s.width, points: s.points.slice() }));
}

/**
 * Loads the model and gives back live predictions for the drawing.
 * In: nothing. Out: model status, latest predictions, timeline and update().
 */
export function usePredictor(): Predictor {
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [latest, setLatest] = useState<ModelView | null>(null);
  const [lastFinal, setLastFinal] = useState<ModelView | null>(null);
  const [timeline, setTimeline] = useState<Timeline>([]);
  const [attempt, setAttempt] = useState(0);

  // These live in refs, not state, because changing them must not re-render.
  const labelsRef = useRef<string[]>([]);
  const strokesRef = useRef<readonly Stroke[]>([]);
  // Pen-lift and undo jobs. They are never skipped, so the timeline gets a
  // point for every stroke even if the user draws very fast.
  const finalJobsRef = useRef<Job[]>([]);
  const drawPendingRef = useRef(false);
  const busyRef = useRef(false);
  const lastRunRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  // Bumped by reset(), so a prediction that finishes after a reset is ignored.
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadModel(), loadLabels()])
      .then(([, loadedLabels]) => {
        if (cancelled) return;
        labelsRef.current = loadedLabels;
        setLabels(loadedLabels);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Clear any waiting timer when the component goes away.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  /** Clears the guesses for an empty canvas. */
  const clearResults = useCallback(() => {
    setPredictions([]);
    setLatest(null);
    setLastFinal(null);
    setTimeline([]);
  }, []);

  // Runs waiting jobs one by one until there are none left. Pen-lift jobs go
  // first; a mid-stroke job always uses the newest strokes.
  const pump = useCallback(async () => {
    if (busyRef.current || labelsRef.current.length === 0) return;
    busyRef.current = true;
    try {
      for (;;) {
        let job = finalJobsRef.current.shift();
        if (!job && drawPendingRef.current) {
          drawPendingRef.current = false;
          job = { strokes: snapshot(strokesRef.current), reason: "draw" };
        }
        if (!job) break;

        lastRunRef.current = performance.now();
        const generation = generationRef.current;
        const processed = preprocess(job.strokes);
        if (!processed) continue;
        const probs = await predict(processed.input);
        // The canvas was cleared while we were busy: drop this result.
        if (generation !== generationRef.current) continue;

        const view: ModelView = { ...processed, probs, strokeCount: job.strokes.length };
        setPredictions(topK(probs, labelsRef.current, TOP_K));
        setLatest(view);
        if (job.reason !== "draw") setLastFinal(view);
        if (job.reason === "strokeEnd") setTimeline((t) => recordStroke(t, view.strokeCount, probs));
      }
    } catch (err) {
      console.error("Prediction failed", err);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const update = useCallback(
    (strokes: readonly Stroke[], reason: ChangeReason) => {
      strokesRef.current = strokes;

      if (reason === "clear" || strokes.length === 0) {
        // Nothing drawn: forget everything, and ignore any running prediction.
        generationRef.current++;
        finalJobsRef.current = [];
        drawPendingRef.current = false;
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        clearResults();
        return;
      }

      if (reason === "draw") {
        // While drawing: wait until PREDICT_INTERVAL_MS has passed since the
        // last run. If a run is already scheduled, it will see the new points.
        if (timerRef.current !== null) return;
        const wait = Math.max(0, PREDICT_INTERVAL_MS - (performance.now() - lastRunRef.current));
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          drawPendingRef.current = true;
          void pump();
        }, wait);
        return;
      }

      // Pen lift or undo: always predict, right away (or right after the
      // current run). Undo also removes the timeline point of that stroke.
      if (reason === "undo") setTimeline((t) => truncateTimeline(t, strokes.length));
      finalJobsRef.current.push({ strokes: snapshot(strokes), reason });
      void pump();
    },
    [clearResults, pump],
  );

  const reset = useCallback(() => {
    generationRef.current++;
    finalJobsRef.current = [];
    drawPendingRef.current = false;
    strokesRef.current = [];
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearResults();
  }, [clearResults]);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { status, error, labels, predictions, latest, lastFinal, timeline, update, reset, retry };
}
