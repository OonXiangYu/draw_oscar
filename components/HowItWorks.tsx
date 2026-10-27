"use client";

// Content of the "How it works" page. All numbers come from
// public/model/metrics.json, which is fetched when the page opens, so the page
// always matches the model that is deployed.

import { useEffect, useState } from "react";
import Link from "next/link";
import PerClassAccuracy from "./charts/PerClassAccuracy";
import TopConfusions from "./charts/TopConfusions";
import TrainingCurve from "./charts/TrainingCurve";
import { displayName } from "@/lib/labels";
import type { Metrics } from "@/lib/types";

const DRAWINGS_PER_CLASS = 15_000;

/** The layers of the CNN, for the diagram. Shapes are channels x height x width. */
const LAYERS = [
  { name: "Input", detail: "your drawing", shape: "1×28×28" },
  { name: "Conv block 1", detail: "2× conv 3×3 · BatchNorm · ReLU · MaxPool", shape: "32×14×14" },
  { name: "Conv block 2", detail: "2× conv 3×3 · BatchNorm · ReLU · MaxPool", shape: "64×7×7" },
  { name: "Conv block 3", detail: "2× conv 3×3 · BatchNorm · ReLU · MaxPool", shape: "128×3×3" },
  { name: "Dense", detail: "flatten · fully connected · ReLU", shape: "256" },
  { name: "Output", detail: "one score per class · softmax", shape: "" },
];

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Loads metrics.json once. Returns the data, or an error message. */
function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/model/metrics.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Metrics>;
      })
      .then(setMetrics)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);
  return { metrics, error };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="prose-section card scroll-mt-6 sm:p-8">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-5">
      <p className="text-4xl font-extrabold tabular-nums text-ink sm:text-5xl">{value}</p>
      <p className="mt-1 text-sm text-ink-2">{label}</p>
    </div>
  );
}

/** A tiny white-on-black crescent, to show why moon and banana look alike. */
function Crescent({ flip = false, label }: { flip?: boolean; label: string }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 28 28" className="h-20 w-20 rounded-md bg-black" role="img" aria-label={label}>
        <path
          d={flip ? "M7 9 Q14 24 22 8" : "M18 5 A9.5 9.5 0 1 0 18 23 A7 7 0 1 1 18 5"}
          fill={flip ? "none" : "white"}
          stroke="white"
          strokeWidth={flip ? 2.2 : 1.6}
          strokeLinecap="round"
        />
        {flip && <path d="M7 9 Q14 18 22 8" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" />}
      </svg>
      <figcaption className="text-xs text-ink-3">{label}</figcaption>
    </figure>
  );
}

export default function HowItWorks() {
  const { metrics: m, error } = useMetrics();

  if (error) {
    return (
      <p role="alert" className="card text-ink">
        Could not load the model results ({error}). Please refresh the page.
      </p>
    );
  }
  if (!m) {
    return (
      <p role="status" className="card text-ink-2">
        Loading the model results...
      </p>
    );
  }

  const numClasses = m.classes.length;
  const total = numClasses * DRAWINGS_PER_CLASS;
  const sortedAcc = m.classes.map((c, i) => ({ c, a: m.per_class_acc[i] })).sort((a, b) => a.a - b.a);
  const worst = sortedAcc[0];
  const best = sortedAcc[sortedAcc.length - 1];
  const top = m.top_confusions[0];
  const lastEpoch = m.history[m.history.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <Section id="data" title="1. The data">
        <p>
          The model learned from Google&apos;s{" "}
          <a href="https://github.com/googlecreativelab/quickdraw-dataset" className="text-accent underline">
            Quick, Draw! dataset
          </a>
          : millions of doodles that people drew in 20 seconds in an online game. I used{" "}
          <strong className="text-ink">{numClasses} classes</strong> with{" "}
          <strong className="text-ink">{DRAWINGS_PER_CLASS.toLocaleString("en-US")} drawings each</strong>, so{" "}
          {total.toLocaleString("en-US")} drawings in total.
        </p>
        <p>
          Each drawing is a tiny <strong className="text-ink">28×28 pixel</strong> gray-scale image with white lines on a
          black background. The data was split into <strong className="text-ink">90% training</strong>,{" "}
          <strong className="text-ink">5% validation</strong> (to watch progress while training) and{" "}
          <strong className="text-ink">5% test</strong> (only used once, at the end, for the final score).
        </p>
      </Section>

      <Section id="model" title="2. The model">
        <p>
          It is a small convolutional neural network (CNN) with about <strong className="text-ink">0.6 million
          parameters</strong>. The conv layers learn to spot small patterns like edges and curves, and stack them into
          bigger shapes like wheels or petals. MaxPool halves the image size after each block, so later layers see more of
          the drawing at once.
        </p>
        <ol className="my-5 flex flex-col items-stretch gap-2 lg:flex-row lg:items-stretch">
          {LAYERS.map((l, i) => (
            <li key={l.name} className="flex flex-1 items-center gap-2 lg:flex-col">
              <div className="flex-1 rounded-xl border border-line bg-surface-2 p-3 lg:w-full">
                <p className="text-sm font-semibold text-ink">{l.name}</p>
                <p className="text-xs text-ink-2">{l.detail}</p>
                <p className="mt-1 font-mono text-xs text-accent">{l.name === "Output" ? `${numClasses}` : l.shape}</p>
              </div>
              {i < LAYERS.length - 1 && (
                <span className="text-ink-3 lg:hidden" aria-hidden>
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>
        <p>Training tricks that helped the model work on new drawings, not just the ones it saw:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-ink-2">
          <li>
            <strong className="text-ink">Data augmentation</strong>: random small rotations, shifts and scaling, so the
            model does not care exactly where or how big you draw.
          </li>
          <li>
            <strong className="text-ink">AdamW</strong> optimizer with a <strong className="text-ink">OneCycle</strong>{" "}
            learning rate: it starts slow, speeds up, then slows down again to settle on a good solution.
          </li>
          <li>
            <strong className="text-ink">Label smoothing</strong>: during training the right answer counts as &quot;very
            likely&quot; instead of 100% sure, which stops the model from becoming overconfident.
          </li>
        </ul>
      </Section>

      <Section id="results" title="3. Results">
        <p>Scores on the test set, which the model never saw during training:</p>
        <div className="my-5 grid gap-4 sm:grid-cols-2">
          <BigNumber value={pct(m.test_top1)} label="Top-1 accuracy: the first guess is right" />
          <BigNumber value={pct(m.test_top3)} label="Top-3 accuracy: the right answer is in the first 3 guesses" />
        </div>
        <p>
          Training ran for {m.history.length} epochs (one epoch = one pass over all training drawings). Validation accuracy
          climbs fast and then levels off at {pct(lastEpoch.val_acc)}, while the loss keeps going down slowly. Hover over the
          charts to see each epoch.
        </p>
        <div className="my-5">
          <TrainingCurve history={m.history} />
        </div>
        <h3 className="mb-2 mt-8 text-lg font-semibold text-ink">Accuracy per class</h3>
        <p>
          Some things are easier to draw than others. {displayName(best.c)} is the easiest ({pct(best.a)}), and{" "}
          {worst.c} is the hardest ({pct(worst.a)}).
        </p>
        <div className="mt-4">
          <PerClassAccuracy classes={m.classes} accuracy={m.per_class_acc} overall={m.test_top1} />
        </div>
      </Section>

      <Section id="mistakes" title="4. Where it fails">
        <p>
          The most common mistake: a <strong className="text-ink">{top.true}</strong> drawn by a person gets guessed as{" "}
          <strong className="text-ink">{top.pred}</strong> ({top.count} times in the test set). Why?
        </p>
        <div className="my-5 flex flex-col items-center gap-5 rounded-xl bg-surface-2 p-5 sm:flex-row">
          <div className="flex shrink-0 gap-4">
            <Crescent label="a moon" />
            <Crescent flip label="a banana" />
          </div>
          <p className="!mb-0">
            The model only sees <strong className="text-ink">shape</strong>: a 28×28 gray image. It has no color, so it
            cannot tell yellow from silver. It has no size, so a moon in the sky and a banana on a table look the same.
            And most people draw both as one curved line. A human would use context; the model has only the lines.
          </p>
        </div>
        <p>
          The other top mistakes follow the same idea: things with the same outline get mixed up (
          {m.top_confusions
            .slice(1, 4)
            .map((c) => `${c.true} and ${c.pred}`)
            .join(", ")}
          ). Here are the {Math.min(10, m.top_confusions.length)} most common mix-ups on
          the test set:
        </p>
        <div className="mt-4">
          <TopConfusions confusions={m.top_confusions} classes={m.classes} matrix={m.confusion_matrix} />
        </div>
        <p className="mt-4">
          These mistakes are also why top-3 accuracy ({pct(m.test_top3)}) is much higher than top-1: when the model is
          wrong, the right answer is still its 2nd or 3rd guess{" "}
          {pct((m.test_top3 - m.test_top1) / (1 - m.test_top1))} of the time.
        </p>
      </Section>

      <Section id="browser" title="5. Running in the browser">
        <div className="my-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
          {["PyTorch (training)", "ONNX (export)", "ONNX Runtime Web (your browser)"].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-surface-2 px-3 py-1.5 text-ink">{step}</span>
              {i < arr.length - 1 && <span className="text-ink-3" aria-hidden>→</span>}
            </span>
          ))}
        </div>
        <p>
          The model was trained in PyTorch and exported to ONNX, an open format for neural networks. ONNX Runtime Web then
          runs it with WebAssembly, right on your device. One guess takes just a few milliseconds.
        </p>
        <p>
          This means <strong className="text-ink">your drawing never leaves your device</strong>. There is no server, so the
          site is free to host as plain static files.
        </p>
        <p>
          Before each guess, your drawing is cropped to its bounding box, centered in a square, shrunk to 28×28 and its
          colors are inverted, so it looks like the training data. You can see the result with &quot;Show what the AI
          sees&quot; on the{" "}
          <Link href="/play" className="text-accent underline">
            play page
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
