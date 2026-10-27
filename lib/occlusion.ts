// "Where is the AI looking?" — occlusion sensitivity.
//
// The idea is simple: hide one small part of the drawing and see how much the
// model's confidence drops. If hiding a part makes the model much less sure,
// that part was important for its guess. We do this for every part of the
// image and get a heatmap of importance.
//
// This works with any model, because it only looks at inputs and outputs.
// The downside is that it needs many model runs, so we send all the hidden
// versions to the model as one batch (shape [N, 1, 28, 28]) instead of 100+
// separate one-image calls.
//
// Used by lib/useHeatmap.ts: runOcclusion(input) once per drawing, then
// heatmapFor(result, classIndex) for any class, with no extra model calls.

import { INPUT_SIZE, runBatch, softmax } from "./model";

/** Size of the square we hide, in 28x28 pixels. */
export const PATCH_SIZE = 6;

/**
 * How far the square moves each step. Smaller = sharper map, but more model
 * runs. We tested 2 first (up to 144 runs, about 220-340 ms on a laptop);
 * 3 (up to 81 runs) looks almost the same and is about twice as fast.
 */
export const PATCH_STRIDE = 3;

/**
 * We send the batch in chunks of this many images. Each chunk is its own model
 * call in the shared queue, so a live guess can run between two chunks and
 * does not have to wait for the whole heatmap.
 */
const CHUNK_SIZE = 48;

const PIXELS = INPUT_SIZE * INPUT_SIZE;

/** Top-left corner of one hidden square. */
interface Patch {
  x: number;
  y: number;
}

/** Output of runOcclusion(). It holds enough to build a heatmap for any class. */
export interface OcclusionResult {
  /** Probabilities for the full, unchanged drawing. */
  baseProbs: number[];
  /** The squares we hid that touched the drawing. */
  patches: Patch[];
  /** probsHidden[i] = probabilities when patches[i] was hidden. */
  probsHidden: number[][];
  /** How long the model call took, in milliseconds. */
  ms: number;
}

/**
 * Lists every square position along one side: 0, 3, 6, ... 21, and then 22,
 * so the last square touches the edge and every pixel is covered.
 */
function positions(): number[] {
  const out: number[] = [];
  for (let p = 0; p + PATCH_SIZE <= INPUT_SIZE; p += PATCH_STRIDE) out.push(p);
  const last = INPUT_SIZE - PATCH_SIZE;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Every square position in 2D: each x position with each y position. */
function allPatches(): Patch[] {
  const steps = positions();
  return steps.flatMap((y) => steps.map((x) => ({ x, y })));
}

const PATCHES = allPatches();

/**
 * Counts how many squares cover each pixel. Pixels in the middle are covered
 * by more squares than pixels at the edge, so we divide by this to be fair.
 */
const COVERAGE = (() => {
  const counts = new Float32Array(PIXELS);
  for (const { x, y } of PATCHES) {
    for (let dy = 0; dy < PATCH_SIZE; dy++) {
      for (let dx = 0; dx < PATCH_SIZE; dx++) counts[(y + dy) * INPUT_SIZE + x + dx]++;
    }
  }
  return counts;
})();

/** Checks if a square has any ink in it. */
function patchHasInk(input: Float32Array, { x, y }: Patch): boolean {
  for (let dy = 0; dy < PATCH_SIZE; dy++) {
    for (let dx = 0; dx < PATCH_SIZE; dx++) {
      if (input[(y + dy) * INPUT_SIZE + x + dx] > 0) return true;
    }
  }
  return false;
}

/**
 * Runs the model on the drawing with each square hidden, all in one batch.
 * In: the 28x28 model input. Out: probabilities for every hidden version.
 */
export async function runOcclusion(input: Float32Array): Promise<OcclusionResult> {
  // Hiding empty background changes nothing (it is already 0), so we skip
  // those squares. Their importance is exactly 0 anyway, and skipping them
  // makes the batch smaller and faster. This is also why the heat always
  // appears on the strokes.
  const patches = PATCHES.filter((p) => patchHasInk(input, p));

  // Build the batch: image 0 is the full drawing, then one copy per square
  // with that square set to 0 (background).
  const count = patches.length + 1;
  const batch = new Float32Array(count * PIXELS);
  batch.set(input, 0);
  patches.forEach(({ x, y }, i) => {
    const offset = (i + 1) * PIXELS;
    batch.set(input, offset);
    for (let dy = 0; dy < PATCH_SIZE; dy++) {
      batch.fill(0, offset + (y + dy) * INPUT_SIZE + x, offset + (y + dy) * INPUT_SIZE + x + PATCH_SIZE);
    }
  });

  // Run the model on the batch, a chunk at a time. The model accepts any
  // batch size, so each chunk is a single call with shape [n, 1, 28, 28].
  const start = performance.now();
  const rows: number[][] = [];
  for (let first = 0; first < count; first += CHUNK_SIZE) {
    const n = Math.min(CHUNK_SIZE, count - first);
    const logits = await runBatch(batch.subarray(first * PIXELS, (first + n) * PIXELS), n);
    // The output is n rows of logits. Softmax each row into probabilities.
    const numClasses = logits.length / n;
    for (let i = 0; i < n; i++) rows.push(softmax(logits.subarray(i * numClasses, (i + 1) * numClasses)));
  }
  const ms = performance.now() - start;
  return { baseProbs: rows[0], patches, probsHidden: rows.slice(1), ms };
}

/**
 * Builds the heatmap for one class from an occlusion result. No model call.
 * In: the result and a class index. Out: 784 values from 0 (not important)
 * to 1 (most important).
 */
export function heatmapFor(result: OcclusionResult, classIndex: number): Float32Array {
  const p = result.baseProbs[classIndex];
  const heat = new Float32Array(PIXELS);

  result.patches.forEach(({ x, y }, i) => {
    // Importance = how much the confidence drops when this square is hidden.
    // If hiding it makes the model MORE sure, we count 0: we only show what
    // supports the guess.
    const importance = Math.max(0, p - result.probsHidden[i][classIndex]);
    if (importance === 0) return;
    for (let dy = 0; dy < PATCH_SIZE; dy++) {
      for (let dx = 0; dx < PATCH_SIZE; dx++) heat[(y + dy) * INPUT_SIZE + x + dx] += importance;
    }
  });

  // Squares overlap, so average: divide each pixel by how many squares cover it.
  let max = 0;
  for (let i = 0; i < PIXELS; i++) {
    heat[i] /= COVERAGE[i];
    if (heat[i] > max) max = heat[i];
  }

  // Scale to 0-1 so the brightest spot is always fully colored.
  if (max > 0) for (let i = 0; i < PIXELS; i++) heat[i] /= max;
  return heat;
}
