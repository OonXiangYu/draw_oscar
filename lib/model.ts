// Loads the ONNX model once and runs predictions in the browser.
//
// The model is a small CNN trained in PyTorch and exported to ONNX.
// ONNX Runtime Web runs it with WebAssembly, right on the user's device:
// no server, and the drawing never leaves the browser.
//
// Only import this file from client components. onnxruntime-web is loaded
// with a dynamic import() so it is never part of server code.

import type { InferenceSession } from "onnxruntime-web";
import type { Prediction } from "./types";

type Ort = typeof import("onnxruntime-web/wasm");

/** Size of the model input image: 28 x 28 pixels, 1 color channel. */
export const INPUT_SIZE = 28;

let ortPromise: Promise<Ort> | null = null;
let sessionPromise: Promise<InferenceSession> | null = null;

/**
 * Loads the ONNX Runtime library (only once).
 * Returns the library module.
 */
function loadOrt(): Promise<Ort> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web/wasm").then((ort) => {
      // Where to find the .wasm file. scripts/copy-ort-wasm.mjs copies it
      // from node_modules into public/ort/ before every dev run and build,
      // so it always matches the installed package version and Vercel serves
      // it as a normal static file.
      ort.env.wasm.wasmPaths = { wasm: "/ort/ort-wasm-simd-threaded.wasm" };
      // One thread is plenty for a model this small. Multi-threading needs
      // special server headers (cross-origin isolation) that we do not need.
      ort.env.wasm.numThreads = 1;
      return ort;
    });
  }
  return ortPromise;
}

/**
 * Loads the model and creates an inference session. This is a singleton:
 * the first call starts loading, later calls get the same session.
 */
export function loadModel(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = loadOrt().then((ort) =>
      ort.InferenceSession.create("/model/model.onnx", {
        executionProviders: ["wasm"],
      }),
    );
    // If loading fails, forget it so the user can try again.
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

/**
 * Softmax: turns raw model scores (logits) into probabilities.
 * In: any list of numbers. Out: numbers from 0 to 1 that add up to 1.
 */
export function softmax(logits: ArrayLike<number>): number[] {
  // Subtract the biggest score first. This does not change the result,
  // but it stops Math.exp() from overflowing to Infinity on big numbers.
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]);

  const exps = Array.from(logits, (x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Top-k: picks the k classes with the highest probability.
 * In: probabilities and class names. Out: k predictions, most likely first.
 */
export function topK(probs: number[], labels: string[], k: number): Prediction[] {
  return probs
    .map((probability, index) => ({ index, label: labels[index] ?? `class ${index}`, probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, k);
}

/**
 * Runs the model on one preprocessed 28x28 image.
 * In: Float32Array of 784 values (0 = background, 1 = stroke).
 * Out: a probability for every class, in labels.json order.
 */
export async function predict(pixels: Float32Array): Promise<number[]> {
  const [ort, session] = await Promise.all([loadOrt(), loadModel()]);

  // The model expects a batch of images: shape [batch, channels, height, width].
  // We send a batch of 1 image with 1 channel (grayscale).
  const input = new ort.Tensor("float32", pixels, [1, 1, INPUT_SIZE, INPUT_SIZE]);
  const output = await session.run({ input });

  // The model returns raw scores ("logits"), not probabilities.
  // Softmax turns them into probabilities we can show as percentages.
  const logits = output.logits.data as Float32Array;
  return softmax(logits);
}
