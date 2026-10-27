"use client";

// Free draw: draw anything and watch the AI guess live.
// Combines the canvas, the top-5 list, the AI voice, the "Where is the AI
// looking?" heatmap, the confidence timeline and the debug preview.

import { useRef, useState } from "react";
import AttentionHeatmap from "./AttentionHeatmap";
import ConfidenceTimeline, { type TimelineSeries } from "./charts/ConfidenceTimeline";
import DrawingCanvas from "./DrawingCanvas";
import ModelInputPreview from "./ModelInputPreview";
import ModelStatusNotice from "./ModelStatusNotice";
import PredictionList from "./PredictionList";
import { aiVoiceLine } from "@/lib/aiVoice";
import { displayName } from "@/lib/labels";
import { assignSlots, seriesFor, topClassesNow } from "@/lib/timeline";
import type { Stroke } from "@/lib/types";
import { useHeatmap } from "@/lib/useHeatmap";
import { usePredictor, type ChangeReason } from "@/lib/usePredictor";

/** Line colors for the timeline, one per slot (validated chart palette). */
const SERIES_COLORS = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)"];

/** Index of the biggest number in a list. */
function argmax(values: number[]): number {
  return values.indexOf(Math.max(...values));
}

export default function FreeDrawMode() {
  const predictor = usePredictor();
  const { labels, lastFinal, timeline } = predictor;
  const [showPreview, setShowPreview] = useState(false);
  const [heatOn, setHeatOn] = useState(false);
  // A class the user clicked in the guess list. Null = explain the top guess.
  const [selected, setSelected] = useState<string | null>(null);
  const slotsRef = useRef<(number | null)[]>([]);
  const ready = predictor.status === "ready";

  // The heatmap explains the last pen-lift result, so it only updates when a
  // stroke ends (or after Undo), not on every move while drawing.
  const topLabel = lastFinal ? labels[argmax(lastFinal.probs)] : null;
  const explained = heatOn ? (selected ?? topLabel) : null;
  const heat = useHeatmap(lastFinal, explained ? labels.indexOf(explained) : null, heatOn);

  const handleChange = (strokes: readonly Stroke[], reason: ChangeReason) => {
    if (strokes.length === 0) setSelected(null);
    predictor.update(strokes, reason);
  };

  const explain = (label: string) => {
    setSelected(label);
    setHeatOn(true);
  };

  // Timeline lines for the 3 classes that are on top right now. Each class
  // keeps its color while it stays in the top 3.
  slotsRef.current = assignSlots(slotsRef.current, topClassesNow(timeline, 3), 3);
  const series: TimelineSeries[] = slotsRef.current.flatMap((classIndex, slot) =>
    classIndex === null
      ? []
      : [{ name: displayName(labels[classIndex]), color: SERIES_COLORS[slot], values: seriesFor(timeline, classIndex) }],
  );

  const voice = ready ? aiVoiceLine(predictor.predictions) : "Warming up my brain...";

  return (
    <div className="flex flex-col gap-4">
      <ModelStatusNotice status={predictor.status} error={predictor.error} onRetry={predictor.retry} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
        <div className="flex flex-col gap-3">
          {/* On phones the guess list sits below the canvas, so show the AI voice up here. */}
          <p className="min-h-7 text-center font-semibold text-ink md:hidden" aria-hidden>
            {voice}
          </p>
          <DrawingCanvas
            onChange={handleChange}
            disabled={!ready}
            overlay={<AttentionHeatmap heatmap={heat.values} transform={heat.transform} />}
          />

          <div className="flex flex-col items-center gap-1.5 text-center">
            <button
              type="button"
              onClick={() => setHeatOn((on) => !on)}
              aria-pressed={heatOn}
              disabled={!ready}
              className={`btn-secondary gap-2 ${heatOn ? "border-heat-strong bg-heat/15" : ""}`}
            >
              <span
                className="h-3 w-3 rounded-full bg-gradient-to-br from-[#f5d020] to-[#e8301e]"
                aria-hidden
              />
              Where is the AI looking?
            </button>
            {heatOn && (
              <p className="max-w-sm text-xs text-ink-2" aria-live="polite">
                Bright areas: if we hide them, the AI becomes much less sure.
                <br />
                {!lastFinal ? (
                  "Draw something first."
                ) : (
                  <>
                    Explaining <strong className="text-ink">{explained && displayName(explained)}</strong>
                    {heat.computing ? " · thinking..." : heat.ms !== null ? ` · ${Math.round(heat.ms)} ms` : ""}
                    {" · "}click a guess to explain it instead.
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <aside className="card flex flex-col gap-5">
          <p className="hidden min-h-12 text-lg font-semibold text-ink md:block" aria-live="polite">
            {voice}
          </p>
          <PredictionList predictions={predictor.predictions} explained={explained} onSelect={explain} />

          <div className="border-t border-line pt-4">
            <ConfidenceTimeline series={series} />
          </div>

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
                <ModelInputPreview input={predictor.latest?.input ?? null} />
              </div>
            )}
          </div>
        </aside>
      </div>

      {labels.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold text-ink">What can I draw? ({labels.length} things)</summary>
          <p className="mt-3 leading-relaxed text-ink-2">{labels.map(displayName).join(" · ")}</p>
        </details>
      )}
    </div>
  );
}
