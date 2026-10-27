// Shows the model's top guesses as a list with confidence bars.
// The bars grow and shrink smoothly (CSS transition) as the user draws.
//
// Usage: <PredictionList predictions={predictions} highlight="bicycle" />

import { displayName } from "@/lib/labels";
import type { Prediction } from "@/lib/types";

interface PredictionListProps {
  predictions: Prediction[];
  /** Number of rows to show, so the layout does not jump. */
  rows?: number;
  /** A class to mark in the list (the target in challenge mode). */
  highlight?: string;
}

/**
 * Renders the top guesses. Empty rows are shown as placeholders.
 * In: predictions sorted from most to least likely.
 */
export default function PredictionList({ predictions, rows = 5, highlight }: PredictionListProps) {
  const slots = Array.from({ length: rows }, (_, i) => predictions[i] ?? null);

  return (
    <ol className="flex flex-col gap-2" aria-label="Top guesses">
      {slots.map((p, i) => {
        const percent = p ? p.probability * 100 : 0;
        const isTarget = p !== null && p.label === highlight;
        return (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className={`font-medium ${isTarget ? "text-good" : p ? "text-ink" : "text-ink-3"}`}>
                {p ? displayName(p.label) : "—"}
                {isTarget && <span className="ml-2 text-xs font-semibold uppercase">target</span>}
              </span>
              <span className="tabular-nums text-ink-2">{p ? `${percent.toFixed(1)}%` : ""}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                  isTarget ? "bg-good" : i === 0 ? "bg-accent" : "bg-accent-soft"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
