"use client";

// React hook that connects the drawing canvas to the model.
//
// It loads the model, and every time the drawing changes it runs a prediction,
// but never more than once every PREDICT_INTERVAL_MS and never two at once.
// Used by the free draw mode and the challenge mode.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLabels } from "./labels";
import { loadModel, predict, topK } from "./model";
import { preprocess } from "./preprocess";
import type { ModelStatus, Prediction } from "./types";

/** Minimum time between two predictions while the user is drawing. */
const PREDICT_INTERVAL_MS = 150;

/** How many guesses to show. */
const TOP_K = 5;

export interface Predictor {
  status: ModelStatus;
  error: string | null;
  labels: string[];
  /** Top guesses for the current drawing, most likely first. Empty if blank. */
  predictions: Prediction[];
  /** The 28x28 image the model last saw, or null if the canvas is blank. */
  modelInput: Float32Array | null;
  /** Call while drawing. `final` = true when the pen lifts (always runs). */
  update: (canvas: HTMLCanvasElement, final?: boolean) => void;
  /** Forget the current guesses (for example after the canvas is cleared). */
  reset: () => void;
  /** Try loading the model again after an error. */
  retry: () => void;
}

/**
 * Loads the model and gives back live predictions for a canvas.
 * In: nothing. Out: model status, latest predictions and an update() function.
 */
export function usePredictor(): Predictor {
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [modelInput, setModelInput] = useState<Float32Array | null>(null);
  const [attempt, setAttempt] = useState(0);

  // These live in refs, not state, because changing them must not re-render.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<string[]>([]);
  const busyRef = useRef(false);
  const queuedRef = useRef(false);
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

  const run = useCallback(async function runPrediction() {
    const canvas = canvasRef.current;
    if (!canvas || labelsRef.current.length === 0) return;

    // Only one prediction at a time. If one is running, remember to run
    // again when it is done, so the last stroke is never missed.
    if (busyRef.current) {
      queuedRef.current = true;
      return;
    }
    busyRef.current = true;
    lastRunRef.current = performance.now();
    const generation = generationRef.current;

    try {
      const input = preprocess(canvas);
      if (!input) {
        if (generation === generationRef.current) {
          setPredictions([]);
          setModelInput(null);
        }
        return;
      }
      const probs = await predict(input);
      if (generation === generationRef.current) {
        setPredictions(topK(probs, labelsRef.current, TOP_K));
        setModelInput(input);
      }
    } catch (err) {
      console.error("Prediction failed", err);
    } finally {
      busyRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void runPrediction();
      }
    }
  }, []);

  const update = useCallback(
    (canvas: HTMLCanvasElement, final = false) => {
      canvasRef.current = canvas;

      if (final) {
        // Pen lifted: run now (or right after the current run finishes).
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        void run();
        return;
      }

      // While drawing: wait until PREDICT_INTERVAL_MS has passed since the
      // last run. If a run is already scheduled, it will see the new strokes.
      if (timerRef.current !== null) return;
      const wait = Math.max(0, PREDICT_INTERVAL_MS - (performance.now() - lastRunRef.current));
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void run();
      }, wait);
    },
    [run],
  );

  const reset = useCallback(() => {
    generationRef.current++;
    queuedRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPredictions([]);
    setModelInput(null);
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { status, error, labels, predictions, modelInput, update, reset, retry };
}
