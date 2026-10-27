// Per-class test accuracy as sorted horizontal bars (best at the top).
// A dashed line marks the overall accuracy, and the weakest classes are
// colored differently so they stand out.
//
// Usage: <PerClassAccuracy classes={m.classes} accuracy={m.per_class_acc} overall={m.test_top1} />

import { displayName } from "@/lib/labels";

/** How many of the weakest classes get the highlight color. */
const WEAKEST_COUNT = 5;

interface PerClassAccuracyProps {
  classes: string[];
  accuracy: number[];
  overall: number;
}

export default function PerClassAccuracy({ classes, accuracy, overall }: PerClassAccuracyProps) {
  const rows = classes
    .map((label, i) => ({ label, acc: accuracy[i] }))
    .sort((a, b) => b.acc - a.acc);
  const weakStart = rows.length - WEAKEST_COUNT;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-series-1" aria-hidden /> Test accuracy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-series-2" aria-hidden /> {WEAKEST_COUNT} weakest classes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 border-l-2 border-dashed border-ink-3" aria-hidden /> Overall: {(overall * 100).toFixed(1)}%
        </span>
      </figcaption>

      <ol className="grid gap-x-8 gap-y-1 md:grid-flow-col md:grid-cols-2" style={{ gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, auto)` }}>
        {rows.map((r, i) => (
          <li
            key={r.label}
            className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-xs"
            title={`${displayName(r.label)}: ${(r.acc * 100).toFixed(1)}%`}
          >
            <span className="truncate text-ink-2">{displayName(r.label)}</span>
            <span className="relative h-3 rounded-r bg-surface-2">
              {/* The bar starts at 0%, so lengths are honest. */}
              <span
                className={`absolute inset-y-0 left-0 rounded-r ${i >= weakStart ? "bg-series-2" : "bg-series-1"}`}
                style={{ width: `${r.acc * 100}%` }}
              />
              <span className="absolute -inset-y-0.5 border-l-2 border-dashed border-ink-3" style={{ left: `${overall * 100}%` }} aria-hidden />
            </span>
            <span className="text-right tabular-nums text-ink">{(r.acc * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
