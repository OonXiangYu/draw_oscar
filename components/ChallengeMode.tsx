"use client";

// Challenge mode: the game gives you a word, you have 20 seconds to draw it,
// and the AI has to recognize it. One round = 6 drawings. After each drawing
// you see where the AI looked (heatmap) and how its confidence grew stroke by
// stroke. At the end you see your score and a small timeline per drawing.

import { useCallback, useEffect, useRef, useState } from "react";
import AttentionHeatmap from "./AttentionHeatmap";
import ConfidenceTimeline from "./charts/ConfidenceTimeline";
import DrawingCanvas from "./DrawingCanvas";
import ModelStatusNotice from "./ModelStatusNotice";
import PredictionList from "./PredictionList";
import { aiVoiceLine } from "@/lib/aiVoice";
import { displayName, withArticle } from "@/lib/labels";
import { firstTopStroke, seriesFor } from "@/lib/timeline";
import type { ModelView, Prediction } from "@/lib/types";
import { useHeatmap } from "@/lib/useHeatmap";
import { usePredictor } from "@/lib/usePredictor";

/** Drawings per round. */
const DRAWINGS_PER_ROUND = 6;
/** Time for each drawing, in milliseconds. */
const TIME_LIMIT_MS = 20_000;

/**
 * The win rule, in one place so it is easy to change:
 * the target must be the model's number 1 guess, with more than 50% confidence.
 */
const SUCCESS_RULE = { mustBeTop1: true, minConfidence: 0.5 };

/** Checks if the current guesses count as a win for the target class. */
function isSuccess(predictions: Prediction[], target: string): boolean {
  const candidates = SUCCESS_RULE.mustBeTop1 ? predictions.slice(0, 1) : predictions;
  return candidates.some((p) => p.label === target && p.probability > SUCCESS_RULE.minConfidence);
}

/** Picks `count` different random classes (Fisher-Yates shuffle). */
function pickTargets(labels: string[], count: number): string[] {
  const pool = [...labels];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

interface DrawingResult {
  target: string;
  success: boolean;
  /** Time until the AI got it, in ms (only when success is true). */
  timeMs: number | null;
  /** The AI's best guess when time ran out. */
  lastGuess: string | null;
  /** Confidence in the target after each stroke (for the end screen). */
  timeline: number[];
  /** The first stroke after which the target was the top guess, or null. */
  gotItStroke: number | null;
}

type Phase = "intro" | "drawing" | "result" | "done";

export default function ChallengeMode() {
  const predictor = usePredictor();
  const { predictions, reset, labels } = predictor;
  const [phase, setPhase] = useState<Phase>("intro");
  const [targets, setTargets] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<DrawingResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_MS);
  const startRef = useRef(0);
  // Stops one drawing from being scored twice (for example a win and the
  // timer ending in the same moment).
  const finishedRef = useRef(false);
  // What the model saw when the drawing ended. The heatmap explains this.
  const [finalView, setFinalView] = useState<ModelView | null>(null);

  const target = targets[current];
  const targetIndex = target ? labels.indexOf(target) : -1;

  // Timeline of the target class, and the stroke where the AI first got it.
  const targetTimeline = targetIndex >= 0 ? seriesFor(predictor.timeline, targetIndex) : [];
  const gotItStroke = targetIndex >= 0 ? firstTopStroke(predictor.timeline, targetIndex) : null;

  // On the result screen, show where the AI looked for the target.
  const heat = useHeatmap(finalView, targetIndex >= 0 ? targetIndex : null, phase === "result");

  /** Starts drawing number `index` of the round. */
  const startDrawing = useCallback(
    (index: number) => {
      reset();
      setCurrent(index);
      setTimeLeft(TIME_LIMIT_MS);
      startRef.current = performance.now();
      finishedRef.current = false;
      setFinalView(null);
      setPhase("drawing");
    },
    [reset],
  );

  const startRound = () => {
    setTargets(pickTargets(predictor.labels, DRAWINGS_PER_ROUND));
    setResults([]);
    startDrawing(0);
  };

  /** Saves the result of the current drawing and shows it. */
  const finishDrawing = useCallback(
    (success: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setResults((prev) => [
        ...prev,
        {
          target,
          success,
          timeMs: success ? performance.now() - startRef.current : null,
          lastGuess: predictions[0]?.label ?? null,
          timeline: [],
          gotItStroke: null,
        },
      ]);
      setFinalView(predictor.latest);
      setPhase("result");
    },
    [predictions, predictor.latest, target],
  );

  /** Goes to the next drawing, or to the end screen after the last one. */
  const next = () => {
    // Save the timeline now, not when the drawing ended: if the AI got it in
    // the middle of a stroke, that stroke's point arrives at the pen lift.
    setResults((prev) =>
      prev.map((r, i) => (i === prev.length - 1 ? { ...r, timeline: targetTimeline, gotItStroke } : r)),
    );
    if (current + 1 >= DRAWINGS_PER_ROUND) setPhase("done");
    else startDrawing(current + 1);
  };

  // Win check: runs every time the model gives new guesses.
  useEffect(() => {
    if (phase === "drawing" && target && isSuccess(predictions, target)) finishDrawing(true);
  }, [phase, predictions, target, finishDrawing]);

  // Countdown timer. 100 ms steps are smooth enough for a progress bar.
  useEffect(() => {
    if (phase !== "drawing") return;
    const id = window.setInterval(() => {
      const left = TIME_LIMIT_MS - (performance.now() - startRef.current);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finishDrawing(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finishDrawing]);

  const ready = predictor.status === "ready";
  const notice = <ModelStatusNotice status={predictor.status} error={predictor.error} onRetry={predictor.retry} />;

  if (phase === "intro") {
    return (
      <div className="flex flex-col gap-4">
        {notice}
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-ink">Can the AI read your drawings?</h2>
          <p className="text-ink-2">
            You get {DRAWINGS_PER_ROUND} words. For each one you have {TIME_LIMIT_MS / 1000} seconds to draw it.
            You score when the AI&apos;s top guess is the word, with more than{" "}
            {SUCCESS_RULE.minConfidence * 100}% confidence.
          </p>
          <button type="button" onClick={startRound} disabled={!ready} className="btn-primary">
            Start challenge
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const score = results.filter((r) => r.success).length;
    return (
      <div className="card mx-auto flex w-full max-w-lg flex-col gap-5">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-3">Your score</p>
          <p className="text-5xl font-bold text-ink">
            {score} / {DRAWINGS_PER_ROUND}
          </p>
          <p className="mt-1 text-ink-2">
            {score === DRAWINGS_PER_ROUND
              ? "Perfect! We understand each other."
              : score >= DRAWINGS_PER_ROUND / 2
                ? "Nice! The AI got most of them."
                : "Tough round. Try simple, big shapes."}
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {results.map((r) => (
            <li key={r.target} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[8rem_6rem_minmax(0,1fr)]">
              <span className="flex items-center gap-2 font-medium text-ink">
                <span aria-hidden className={r.success ? "text-good" : "text-bad"}>
                  {r.success ? "✓" : "✗"}
                </span>
                {displayName(r.target)}
              </span>
              <ConfidenceTimeline
                variant="spark"
                series={[{ name: displayName(r.target), color: "var(--color-series-1)", values: r.timeline }]}
                marker={r.gotItStroke ? { stroke: r.gotItStroke, label: `Got it at stroke ${r.gotItStroke}` } : undefined}
                title={`AI confidence in ${r.target} after each stroke`}
              />
              <span className="col-span-2 text-sm text-ink-2 sm:col-span-1 sm:text-right">
                {r.success
                  ? `Got it in ${((r.timeMs ?? 0) / 1000).toFixed(1)}s`
                  : r.lastGuess
                    ? `Missed. AI thought: ${r.lastGuess}`
                    : "Missed. Nothing drawn"}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={startRound} className="btn-primary self-center">
          Play again
        </button>
      </div>
    );
  }

  // Phase "drawing" or "result".
  const lastResult = phase === "result" ? results[results.length - 1] : null;
  const timeFraction = timeLeft / TIME_LIMIT_MS;
  const isLast = current + 1 >= DRAWINGS_PER_ROUND;

  return (
    <div className="flex flex-col gap-4">
      {notice}
      {lastResult ? (
        <div role="status" className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-ink-3">
              Drawing {current + 1} of {DRAWINGS_PER_ROUND}: {withArticle(lastResult.target)}
            </p>
            <p className={`text-2xl font-bold ${lastResult.success ? "text-good" : "text-bad"}`}>
              {lastResult.success ? "Got it!" : "Time's up!"}{" "}
              <span className="text-base font-medium text-ink-2">
                {lastResult.success
                  ? `The AI recognized it in ${((lastResult.timeMs ?? 0) / 1000).toFixed(1)}s.`
                  : `The AI did not see ${withArticle(lastResult.target)}.`}
              </span>
            </p>
          </div>
          <button type="button" onClick={next} className="btn-primary" autoFocus>
            {isLast ? "See results" : "Next drawing"}
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-ink-3">
              Drawing {current + 1} of {DRAWINGS_PER_ROUND}
            </p>
            <p className="tabular-nums text-sm font-semibold text-ink-2" aria-live="off">
              {(timeLeft / 1000).toFixed(1)}s
            </p>
          </div>
          <p className="text-2xl font-bold text-ink sm:text-3xl">
            Draw: <span className="text-accent">{withArticle(target)}</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className={`h-full rounded-full ${timeFraction < 0.25 ? "bg-bad" : "bg-accent"}`}
              style={{ width: `${timeFraction * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
        <div className="flex flex-col gap-3">
          {/* On phones the guess list sits below the canvas, so show the AI voice up here. */}
          <p className="min-h-7 text-center font-semibold text-ink md:hidden" aria-hidden>
            {aiVoiceLine(predictions)}
          </p>
          {/* A new key gives a fresh, empty canvas for every drawing. */}
          <DrawingCanvas
            key={current}
            onChange={predictor.update}
            disabled={phase !== "drawing"}
            overlay={<AttentionHeatmap heatmap={heat.values} transform={heat.transform} />}
          />
          {lastResult && finalView && (
            <p className="text-center text-xs text-ink-2">
              Where the AI looked for <strong className="text-ink">{lastResult.target}</strong>. Bright areas: if we hide
              them, the AI becomes much less sure.
              {heat.computing && " Thinking..."}
            </p>
          )}
        </div>

        <aside className="card flex flex-col gap-5">
          <p className="hidden min-h-12 text-lg font-semibold text-ink md:block" aria-live="polite">
            {aiVoiceLine(predictions)}
          </p>
          <PredictionList predictions={predictions} highlight={target} />
          {phase === "drawing" && (
            <button type="button" onClick={() => finishDrawing(false)} className="btn-secondary self-start">
              Skip this one
            </button>
          )}
          {lastResult && (
            <div className="border-t border-line pt-4">
              <ConfidenceTimeline
                title={`Confidence in "${lastResult.target}"`}
                series={[{ name: displayName(lastResult.target), color: "var(--color-series-1)", values: targetTimeline }]}
                marker={gotItStroke ? { stroke: gotItStroke, label: `Got it at stroke ${gotItStroke}` } : undefined}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
