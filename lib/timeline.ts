// Confidence timeline: how sure the AI was about each class after every stroke.
//
// After each stroke ends we save the full list of probabilities from the
// pen-lift prediction (no extra model calls). timeline[i] = the probabilities
// after stroke i + 1. These small functions read and update that list.

/** Probabilities for every class, one entry per finished stroke. */
export type Timeline = number[][];

/**
 * Saves the probabilities after stroke number `strokeCount` (1, 2, 3, ...).
 * Anything saved for later strokes is dropped, because the drawing changed.
 */
export function recordStroke(timeline: Timeline, strokeCount: number, probs: number[]): Timeline {
  return [...timeline.slice(0, strokeCount - 1), probs];
}

/** Keeps only the first `strokeCount` points. Used after Undo. */
export function truncateTimeline(timeline: Timeline, strokeCount: number): Timeline {
  return timeline.length > strokeCount ? timeline.slice(0, strokeCount) : timeline;
}

/** Confidence for one class at every stroke. */
export function seriesFor(timeline: Timeline, classIndex: number): number[] {
  return timeline.map((probs) => probs[classIndex] ?? 0);
}

/** The `k` most likely classes after the last stroke, most likely first. */
export function topClassesNow(timeline: Timeline, k: number): number[] {
  const last = timeline[timeline.length - 1];
  if (!last) return [];
  return last
    .map((p, i) => [p, i] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, i]) => i);
}

/**
 * The first stroke (1, 2, 3, ...) after which `classIndex` was the top guess,
 * or null if it never was.
 */
export function firstTopStroke(timeline: Timeline, classIndex: number): number | null {
  for (let i = 0; i < timeline.length; i++) {
    const probs = timeline[i];
    if (probs.indexOf(Math.max(...probs)) === classIndex) return i + 1;
  }
  return null;
}

/**
 * Gives each class a color slot that stays the same while the class stays in
 * the top list. The colors then follow the class, not its rank, so lines do
 * not swap colors when two classes trade places.
 * In: last slots (slot -> class) and the new classes. Out: new slots.
 */
export function assignSlots(previous: (number | null)[], classes: number[], slotCount: number): (number | null)[] {
  const slots: (number | null)[] = Array.from({ length: slotCount }, (_, i) =>
    previous[i] != null && classes.includes(previous[i]!) ? previous[i]! : null,
  );
  for (const c of classes) {
    if (slots.includes(c)) continue;
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = c;
  }
  return slots;
}
