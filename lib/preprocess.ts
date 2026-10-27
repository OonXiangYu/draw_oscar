// Turns the user's drawing into the 28x28 image the model expects.
//
// This is the most important step of the whole app. The model was trained on
// Quick, Draw! images: small 28x28 pictures with white strokes on a black
// background, centered, with a small margin. If our input does not look like
// that, the model will guess badly, even though the model itself is fine.
//
// Used by lib/usePredictor.ts: preprocess(canvas) -> Float32Array | null.

import { INPUT_SIZE } from "./model";

/** How much of the square the drawing should fill (the rest is margin). */
const FILL_RATIO = 0.8;

/**
 * A pixel counts as "ink" if it is darker than this (0 = black, 255 = white).
 * It is a bit below 255 so we also catch the soft, anti-aliased stroke edges.
 */
const INK_THRESHOLD = 250;

/** Size of the middle step when shrinking the image (see resizeTo28). */
const MID_SIZE = INPUT_SIZE * 2;

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
 * Finds the smallest box that holds all the ink on the canvas.
 * In: raw RGBA pixels. Out: the box in canvas pixels, or null if it is empty.
 */
function findBoundingBox(image: ImageData) {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // The drawing is gray-scale, so the red channel is enough.
      if (data[(y * width + x) * 4] < INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Shrinks a square canvas down to 28x28.
 * In: a square canvas of any size. Out: a 28x28 canvas.
 */
function resizeTo28(source: HTMLCanvasElement): HTMLCanvasElement {
  // Shrinking a big image to 28x28 in one jump skips pixels, so thin lines
  // can break up or vanish. Halving the size a few times, then a last step
  // from 56 to 28, averages the pixels properly and keeps the lines solid.
  let current = source;
  let size = source.width;
  while (size > INPUT_SIZE) {
    size = size > MID_SIZE ? Math.max(MID_SIZE, Math.round(size / 2)) : INPUT_SIZE;
    const { canvas, ctx } = makeCanvas(size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, size, size);
    current = canvas;
  }
  return current;
}

/**
 * Converts the drawing canvas (black lines on white) into model input.
 * In: the drawing canvas, at any size or devicePixelRatio.
 * Out: 784 numbers (28 rows x 28 columns, row by row), 0 = background,
 * 1 = stroke. Returns null if nothing is drawn.
 */
export function preprocess(drawing: HTMLCanvasElement): Float32Array | null {
  const srcCtx = drawing.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) return null;

  // Step 1: find where the drawing is.
  const image = srcCtx.getImageData(0, 0, drawing.width, drawing.height);
  const box = findBoundingBox(image);
  if (!box) return null;

  // Step 2: make a square around the drawing, using the longer side, so the
  // shape is not stretched when we shrink it. Then grow the square so the
  // drawing fills about 80% of it, like the margin in the training images.
  const boxWidth = box.maxX - box.minX + 1;
  const boxHeight = box.maxY - box.minY + 1;
  const side = Math.ceil(Math.max(boxWidth, boxHeight) / FILL_RATIO);

  // Step 3: copy the drawing into the square, centered. The square starts
  // white, so any part outside the original canvas is just background.
  const centerX = box.minX + boxWidth / 2;
  const centerY = box.minY + boxHeight / 2;
  const { canvas: square, ctx: squareCtx } = makeCanvas(side, side);
  squareCtx.fillStyle = "#fff";
  squareCtx.fillRect(0, 0, side, side);
  squareCtx.drawImage(drawing, side / 2 - centerX, side / 2 - centerY);

  // Step 4: shrink to 28x28 with smoothing.
  const small = resizeTo28(square);
  const pixels = small.getContext("2d")!.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

  // Step 5: invert colors, because the model was trained on white lines on a
  // black background: stroke = 1, background = 0.
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  let max = 0;
  for (let i = 0; i < input.length; i++) {
    const value = 1 - pixels[i * 4] / 255;
    input[i] = value;
    if (value > max) max = value;
  }

  // Step 6: stretch the contrast so the darkest stroke pixel becomes exactly 1.
  // After shrinking, a thin line can turn light gray. The training strokes
  // are solid white, so this makes our input look more like them.
  if (max > 0 && max < 1) {
    for (let i = 0; i < input.length; i++) input[i] /= max;
  }

  return input;
}
