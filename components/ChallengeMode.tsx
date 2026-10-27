"use client";

// Challenge mode: the game gives you a word, you have 20 seconds to draw it,
// and the AI has to recognize it. One round = 6 drawings. At the end you see
// your score and which drawings the AI got or missed.

import { useCallback, useEffect, useRef, useState } from "react";
import DrawingCanvas from "./DrawingCanvas";
import ModelStatusNotice from "./ModelStatusNotice";
import PredictionList from "./PredictionList";
import { aiVoiceLine } from "@/lib/aiVoice";
import { displayName, withArticle } from "@/lib/labels";
import type { Prediction } from "@/lib/types";
import { usePredictor } from "@/lib/usePredictor";

/** Drawings per round. */
const DRAWINGS_PER_ROUND = 6;
/** Time for each drawing, in milliseconds. */
const TIME_LIMIT_MS = 20_000;
/** How long the result of one drawing stays on screen before the next one. */
const RESULT_PAUSE_MS = 2_500;

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
}

type Phase = "intro" | "drawing" | "result" | "done";

export default function ChallengeMode() {
  const predictor = usePredictor();
  const { predictions, reset } = predictor;
  const [phase, setPhase] = useState<Phase>("intro");
  const [targets, setTargets] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<DrawingResult[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_MS);
  const startRef = useRef(0);
  // Stops one drawing from being scored twice (for example a win and the
  // timer ending in the same moment).
  const finishedRef = useRef(false);

  const target = targets[current];

  /** Starts drawing number `index` of the round. */
  const startDrawing = useCallback(
    (index: number) => {
      reset();
      setCurrent(index);
      setTimeLeft(TIME_LIMIT_MS);
      startRef.current = performance.now();
      finishedRef.current = false;
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
        },
      ]);
      setPhase("result");
    },
    [predictions, target],
  );

  /** Goes to the next drawing, or to the end screen after the last one. */
  const next = useCallback(() => {
    if (current + 1 >= DRAWINGS_PER_ROUND) setPhase("done");
    else startDrawing(current + 1);
  }, [current, startDrawing]);

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

  // After showing a result for a moment, move on by itself.
  useEffect(() => {
    if (phase !== "result") return;
    const id = window.setTimeout(next, RESULT_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [phase, next]);

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
            <li key={r.target} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 font-medium text-ink">
                <span aria-hidden className={r.success ? "text-good" : "text-bad"}>
                  {r.success ? "✓" : "✗"}
                </span>
                {displayName(r.target)}
              </span>
              <span className="text-right text-sm text-ink-2">
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

  return (
    <div className="flex flex-col gap-4">
      {notice}
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

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
        <div className="relative flex flex-col gap-3">
          {/* On phones the guess list sits below the canvas, so show the AI voice up here. */}
          <p className="min-h-7 text-center font-semibold text-ink md:hidden" aria-hidden>
            {aiVoiceLine(predictions)}
          </p>
          {/* A new key gives a fresh, empty canvas for every drawing. */}
          <DrawingCanvas key={current} onChange={predictor.update} onClear={reset} disabled={phase !== "drawing"} />
          {lastResult && (
            <div
              role="status"
              className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-2xl bg-surface px-6 py-4 text-center shadow-lg ring-1 ring-line"
            >
              <p className={`text-2xl font-bold ${lastResult.success ? "text-good" : "text-bad"}`}>
                {lastResult.success ? "Got it!" : "Time's up!"}
              </p>
              <p className="text-sm text-ink-2">
                {lastResult.success
                  ? `The AI recognized it in ${((lastResult.timeMs ?? 0) / 1000).toFixed(1)}s`
                  : `It was ${withArticle(lastResult.target)}.`}
              </p>
              <button type="button" onClick={next} className="btn-secondary mt-3">
                {current + 1 >= DRAWINGS_PER_ROUND ? "See results" : "Next drawing"}
              </button>
            </div>
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
        </aside>
      </div>
    </div>
  );
}
