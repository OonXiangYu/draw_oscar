# Doodle Guess

Draw something on the canvas and a small neural network guesses what it is, live, while you draw.
The model is a CNN trained on Google's Quick, Draw! doodles. It runs fully in your browser with
ONNX Runtime Web, so there is no backend server and your drawing never leaves your device.

Source code: https://github.com/OonXiangYu/draw_oscar

![Screenshot of Doodle Guess](docs/screenshot.png)
<!-- TODO: add a screenshot at docs/screenshot.png -->

## Features

- **Free draw**: the top 5 guesses update live, with a fun "AI voice".
- **Challenge mode**: 6 words, 20 seconds each. Can the AI recognize your drawings?
- **"Show what the AI sees"**: see the exact 28×28 image the model gets.
- **"Where is the AI looking?" heatmap**: occlusion sensitivity shows which parts of your drawing the
  AI used for its guess. Click any guess to see why the AI thinks it could be that.
- **Confidence timeline**: a chart of how sure the AI was after each stroke. In challenge mode it
  marks the stroke where the AI got it, with small timelines on the end screen.
- **Brush sizes**: Thin, Medium and Thick. The model input is rebuilt from the stroke points with a
  fixed line width, so the brush size does not change what the model sees.
- **How it works** page: the data, the model, training curves, accuracy per class, and the model's
  most common mistakes.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To check a production build: `npm run build` and then `npm start`.

## Deploy on Vercel (free)

1. Push this project to a GitHub repo.
2. On [vercel.com](https://vercel.com), click **Add New Project** and import the repo.
3. Click **Deploy**. No settings need to change.

## Project structure

```
app/             Pages: home, /play, /how-it-works, shared layout
components/      UI pieces: DrawingCanvas, PredictionList, ChallengeMode, charts/, ...
lib/             Logic with no UI
  preprocess.ts    Stroke points -> 28x28 model input (center, scale, redraw with a fixed line)
  occlusion.ts     Occlusion sensitivity heatmap (one batched model call)
  timeline.ts      Confidence-after-each-stroke helpers
  model.ts         Loads the ONNX model once, runs predict(), softmax, top-k
  usePredictor.ts  React hook: throttled live predictions while drawing
public/model/    model.onnx, labels.json, metrics.json
scripts/         copy-ort-wasm.mjs: copies the ONNX Runtime .wasm file into public/ort/
```

## How the model works

- **Data**: 54 classes from the Quick, Draw! dataset, 15,000 drawings per class, as 28×28
  gray-scale images (white lines on black). Split 90% train / 5% validation / 5% test.
- **Model**: a small CNN with 3 conv blocks (two 3×3 convs with BatchNorm and ReLU, then MaxPool),
  followed by 2 dense layers. About 0.6 million parameters.
- **Training**: PyTorch, with random rotate/shift/scale augmentation, AdamW, a OneCycle learning
  rate and label smoothing. About 92.5% top-1 and 97.2% top-3 accuracy on the test set.
- **In the browser**: the PyTorch model was exported to ONNX and runs with ONNX Runtime Web
  (WebAssembly). The strokes are centered, scaled to 28×28 and redrawn as thin white lines on black
  so they look like the training data (see `lib/preprocess.ts`).

## Data credit

Drawings data: [Quick, Draw! Dataset](https://github.com/googlecreativelab/quickdraw-dataset) by
Google, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Author

[GitHub](https://github.com/OonXiangYu) · [LinkedIn](https://www.linkedin.com/in/oscaroon)
