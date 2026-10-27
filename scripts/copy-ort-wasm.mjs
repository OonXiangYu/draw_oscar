// Copies the ONNX Runtime Web WASM file from node_modules into public/ort/.
//
// Why: the browser must download this .wasm file to run the model. By serving
// it from our own site (instead of a CDN) the version always matches the
// installed package, and it works offline and on Vercel with no extra setup.
// This script runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "onnxruntime-web", "dist");
const outDir = join(root, "public", "ort");

// We use the plain WASM backend ("onnxruntime-web/wasm"). Its JS glue code is
// already bundled into our app, so only the .wasm binary is needed here.
const files = ["ort-wasm-simd-threaded.wasm"];

mkdirSync(outDir, { recursive: true });
for (const file of files) {
  copyFileSync(join(srcDir, file), join(outDir, file));
  console.log(`copied ${file} -> public/ort/`);
}
