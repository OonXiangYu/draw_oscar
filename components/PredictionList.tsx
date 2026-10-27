// Shows the model's top guesses as a list with confidence bars.
// The bars grow and shrink smoothly (CSS transition) as the user draws.
// If `onSelect` is given, each guess is a button: clicking it asks the
// heatmap to explain that class.
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
  /** The class the heatmap is explaining right now, if any. */
  explained?: string | null;
  /** Called with a class name when the user clicks a guess. */
  onSelect?: (label: string) => void;
}

/**
 * Renders the top guesses. Empty rows are shown as placeholders.
 * In: predictions sorted from most to least likely.
 */
export default function PredictionList({ predictions, rows = 5, highlight, explained, onSelect }: PredictionListProps) {
  const slots = Array.from({ length: rows }, (_, i) => predictions[i] ?? null);

  return (
    <ol className="flex flex-col gap-1" aria-label="Top guesses">
      {slots.map((p, i) => {
        const percent = p ? p.probability * 100 : 0;
        const isTarget = p !== null && p.label === highlight;
        const isExplained = p !== null && p.label === explained;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className={`font-medium ${isTarget ? "text-good" : p ? "text-ink" : "text-ink-3"}`}>
                {p ? displayName(p.label) : "—"}
                {isTarget && <span className="ml-2 text-xs font-semibold uppercase">target</span>}
                {isExplained && (
                  <span className="ml-2 rounded-full bg-heat/20 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                    explained
                  </span>
                )}
              </span>
              <span className="tabular-nums text-ink-2">{p ? `${percent.toFixed(1)}%` : ""}</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                  isTarget ? "bg-good" : i === 0 ? "bg-accent" : "bg-accent-soft"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={i}>
            {onSelect && p ? (
              <button
                type="button"
                onClick={() => onSelect(p.label)}
                aria-pressed={isExplained}
                title={`Show where the AI looks for "${p.label}"`}
                className={`-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition hover:bg-surface-2/70 focus-visible:outline-2 focus-visible:outline-accent ${
                  isExplained ? "bg-surface-2/70 ring-1 ring-line" : ""
                }`}
              >
                {content}
              </button>
            ) : (
              <div className="py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
