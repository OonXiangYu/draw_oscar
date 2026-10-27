"use client";

// Free draw: draw anything and watch the AI guess live.
// Combines the canvas, the top-5 list, the AI voice and the debug preview.

import { useState } from "react";
import DrawingCanvas from "./DrawingCanvas";
import ModelInputPreview from "./ModelInputPreview";
import ModelStatusNotice from "./ModelStatusNotice";
import PredictionList from "./PredictionList";
import { aiVoiceLine } from "@/lib/aiVoice";
import { displayName } from "@/lib/labels";
import { usePredictor } from "@/lib/usePredictor";

export default function FreeDrawMode() {
  const predictor = usePredictor();
  const [showPreview, setShowPreview] = useState(false);
  const ready = predictor.status === "ready";

  return (
    <div className="flex flex-col gap-4">
      <ModelStatusNotice status={predictor.status} error={predictor.error} onRetry={predictor.retry} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
        <div className="flex flex-col gap-3">
          {/* On phones the guess list sits below the canvas, so show the AI voice up here. */}
          <p className="min-h-7 text-center font-semibold text-ink md:hidden" aria-hidden>
            {ready ? aiVoiceLine(predictor.predictions) : "Warming up my brain..."}
          </p>
          <DrawingCanvas onChange={predictor.update} onClear={predictor.reset} disabled={!ready} />
        </div>

        <aside className="card flex flex-col gap-5">
          <p className="hidden min-h-12 text-lg font-semibold text-ink md:block" aria-live="polite">
            {ready ? aiVoiceLine(predictor.predictions) : "Warming up my brain..."}
          </p>
          <PredictionList predictions={predictor.predictions} />

          <div className="border-t border-line pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-2">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Show what the AI sees
            </label>
            {showPreview && (
              <div className="mt-4">
                <ModelInputPreview input={predictor.modelInput} />
              </div>
            )}
          </div>
        </aside>
      </div>

      {predictor.labels.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            What can I draw? ({predictor.labels.length} things)
          </summary>
          <p className="mt-3 leading-relaxed text-ink-2">
            {predictor.labels.map(displayName).join(" · ")}
          </p>
        </details>
      )}
    </div>
  );
}
