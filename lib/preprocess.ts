// Turns the user's strokes into the 28x28 image the model expects.
//
// This is the most important step of the whole app. The model was trained on
// Quick, Draw! images: small 28x28 pictures with white strokes on a black
// background, centered, with a small margin. If our input does not look like
// that, the model will guess badly, even though the model itself is fine.
//
// We build the image from the stroke POINTS, not from the canvas pixels.
// The Quick, Draw! images were also drawn from vector strokes, and this way
// the line width in the 28x28 image is always the same: it does not depend on
// the brush size the user picked, or on how big or small they drew.
//
// Used by lib/usePredictor.ts: preprocess(strokes) -> { input, transform } | null.

import { INPUT_SIZE } from "./model";
import type { InputTransform, Stroke } from "./types";

/** How much of the 28x28 square the drawing should fill (the rest is margin). */
const FILL_RATIO = 0.8;

/**
 * Line width in 28x28 pixels. Tuned by testing 14 test drawings with widths
 * from 1 to 3 px: 1 to 1.5 px works best (like the training images). Wider
 * lines blur small details, so for example a moon starts to look like a banana.
 */
const LINE_WIDTH = 1.25;

/**
 * We draw 4x bigger than 28x28 first, then shrink. Drawing straight at 28x28
 * makes thin diagonal lines look jagged; shrinking averages them smoothly.
 */
const RENDER_SCALE = 4;

/** Output of preprocess(): the model input and how we got it. */
export interface PreprocessResult {
  /** 784 numbers (28 rows x 28 columns), 0 = background, 1 = stroke. */
  input: Float32Array;
  /** Maps canvas points (0 to 1) to 28x28 coordinates. Used by the heatmap. */
  transform: InputTransform;
}

/**
 * Creates an off-screen canvas of the given size.
 * Returns the canvas and its 2D context.
 */
function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not supported in this browser");
  return { canvas, ctx };
}

/**
 * Works out how to scale and move the drawing so it is centered in the 28x28
 * box and fills about 80% of it. Returns null if there are no points.
 */
export function computeTransform(strokes: Stroke[]): InputTransform | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (maxX < minX) return null;

  // Use the longer side, so the shape is not stretched. A single dot has a
  // size of 0, so we give it a tiny minimum size to avoid dividing by zero.
  const side = Math.max(maxX - minX, maxY - minY, 1e-3);
  const scale = (INPUT_SIZE * FILL_RATIO) / side;

  // Move the center of the drawing to the center of the 28x28 box.
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    scale,
    offsetX: INPUT_SIZE / 2 - centerX * scale,
    offsetY: INPUT_SIZE / 2 - centerY * scale,
  };
}

/**
 * Converts the strokes into model input.
 * In: strokes with points from 0 to 1. Out: the 28x28 input and the
 * transform, or null if nothing is drawn.
 */
export function preprocess(strokes: Stroke[]): PreprocessResult | null {
  // Step 1: find where the drawing is, and how to fit it in the 28x28 box.
  const transform = computeTransform(strokes);
  if (!transform) return null;

  // Step 2: draw the strokes again, white on black, like the training data.
  // We draw at 4x size (112x112) with a fixed line width.
  const big = INPUT_SIZE * RENDER_SCALE;
  const { canvas, ctx } = makeCanvas(big, big);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, big, big);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = LINE_WIDTH * RENDER_SCALE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const k = transform.scale * RENDER_SCALE;
  const toX = (x: number) => x * k + transform.offsetX * RENDER_SCALE;
  const toY = (y: number) => y * k + transform.offsetY * RENDER_SCALE;

  for (const { points } of strokes) {
    if (points.length === 0) continue;
    if (points.length === 1) {
      // A single tap is a dot.
      ctx.beginPath();
      ctx.arc(toX(points[0].x), toY(points[0].y), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(toX(points[i].x), toY(points[i].y));
    ctx.stroke();
  }

  // Step 3: shrink to 28x28 in two halving steps (112 -> 56 -> 28). Each step
  // averages 2x2 pixels, so lines stay smooth and do not break up.
  let current = canvas;
  for (let size = big / 2; size >= INPUT_SIZE; size /= 2) {
    const next = makeCanvas(size, size);
    next.ctx.imageSmoothingEnabled = true;
    next.ctx.imageSmoothingQuality = "high";
    next.ctx.drawImage(current, 0, 0, size, size);
    current = next.canvas;
  }
  const pixels = current.getContext("2d")!.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  // Step 4: turn pixels into numbers from 0 to 1 (the red channel is enough,
  // the image is gray). Strokes are already white = 1, background black = 0.
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  let max = 0;
  for (let i = 0; i < input.length; i++) {
    input[i] = pixels[i * 4] / 255;
    if (input[i] > max) max = input[i];
  }

  // Step 5: stretch the contrast so the brightest stroke pixel is exactly 1.
  // A very short stroke can come out light gray after shrinking. The training
  // strokes are solid white, so this makes our input look more like them.
  if (max > 0 && max < 1) {
    for (let i = 0; i < input.length; i++) input[i] /= max;
  }

  return { input, transform };
}
