// The pairs of classes the model mixes up most on the test set, from
// metrics.json "top_confusions". Each row: true class -> wrong guess.
//
// Usage: <TopConfusions confusions={m.top_confusions} classes={m.classes} matrix={m.confusion_matrix} />

import { displayName } from "@/lib/labels";
import type { Confusion } from "@/lib/types";

interface TopConfusionsProps {
  confusions: Confusion[];
  classes: string[];
  /** Used to know how many test drawings each class has. */
  matrix: number[][];
  limit?: number;
}

export default function TopConfusions({ confusions, classes, matrix, limit = 10 }: TopConfusionsProps) {
  const rows = confusions.slice(0, limit);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  /** Number of test drawings of a class = sum of its row in the confusion matrix. */
  const testCount = (label: string) => {
    const i = classes.indexOf(label);
    return i >= 0 ? matrix[i].reduce((a, b) => a + b, 0) : 0;
  };

  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const total = testCount(r.true);
        return (
          <li key={`${r.true}-${r.pred}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_9rem]">
            <span className="truncate text-ink">
              <span className="font-semibold">{displayName(r.true)}</span>
              <span className="text-ink-3"> → </span>
              {r.pred}
            </span>
            <span className="h-3">
              <span className="block h-full rounded-r bg-series-2" style={{ width: `${(r.count / maxCount) * 100}%`, minWidth: 4 }} />
            </span>
            <span className="whitespace-nowrap text-xs tabular-nums text-ink-2">
              {r.count} drawings
              {total > 0 && <span className="text-ink-3"> ({((r.count / total) * 100).toFixed(0)}%)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
