"use client";

// Training curves from metrics.json "history": validation accuracy and
// training loss for each epoch. Plain SVG, no chart library.
// Hover (or tap) a chart to see the exact values for one epoch.
//
// Usage: <TrainingCurve history={metrics.history} />

import { useState } from "react";
import type { HistoryEntry } from "@/lib/types";

interface Series {
  name: string;
  color: string;
  values: number[];
  format: (v: number) => string;
}

// Size of the drawing area in SVG units. The SVG scales to its container.
const W = 480;
const H = 240;
const PAD = { top: 16, right: 64, bottom: 32, left: 44 };

/**
 * One small line chart with a hover crosshair and tooltip.
 * In: x values (epochs), one or more series, and the y range to show.
 */
function LineChart({
  title,
  xs,
  series,
  yMin,
  yMax,
  yTicks,
  yFormat,
}: {
  title: string;
  xs: number[];
  series: Series[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  yFormat: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (xs.length === 1 ? plotW / 2 : (i / (xs.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  /** Finds the epoch closest to the pointer. */
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((svgX - PAD.left) / plotW) * (xs.length - 1));
    setHover(Math.min(xs.length - 1, Math.max(0, i)));
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{title}</span>
        {series.length > 1 && (
          <span className="flex gap-3 text-xs text-ink-2">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-pan-y"
          role="img"
          aria-label={title}
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Grid lines and y-axis labels. */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-ink-3)">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {/* X-axis labels: every other epoch, so they do not crowd. */}
          {xs.map((ep, i) =>
            i % 2 === 0 || i === xs.length - 1 ? (
              <text key={ep} x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                {ep}
              </text>
            ) : null,
          )}
          <text x={W - PAD.right} y={H - 10} dx={8} fontSize={11} fill="var(--color-ink-3)">
            epoch
          </text>

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-ink-3)" strokeWidth={1} strokeDasharray="3 3" />
          )}

          {series.map((s) => {
            const last = s.values.length - 1;
            return (
              <g key={s.name}>
                <polyline
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Direct label at the end of each line. */}
                <text x={x(last) + 8} y={y(s.values[last])} dy="0.32em" fontSize={11} fontWeight={600} fill="var(--color-ink-2)">
                  {s.format(s.values[last])}
                </text>
                {hover !== null && (
                  <circle cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={2} />
                )}
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > xs.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <p className="mb-1 font-semibold text-ink">Epoch {xs[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}: <span className="font-semibold tabular-nums text-ink">{s.format(s.values[hover])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Builds evenly spaced tick values from min to max. */
function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/**
 * Two charts side by side: validation accuracy (top-1 and top-3) and
 * training loss. Loss gets its own chart because it uses a different scale.
 */
export default function TrainingCurve({ history }: { history: HistoryEntry[] }) {
  const xs = history.map((h) => h.epoch);
  const acc1 = history.map((h) => h.val_acc);
  const acc3 = history.map((h) => h.val_top3);
  const loss = history.map((h) => h.loss);

  // Zoom the accuracy axis to the useful range, rounded to 5% steps.
  const accMin = Math.floor(Math.min(...acc1) * 20) / 20;
  const lossMin = Math.floor(Math.min(...loss) * 5) / 5;
  const lossMax = Math.ceil(Math.max(...loss) * 5) / 5;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LineChart
        title="Validation accuracy"
        xs={xs}
        series={[
          { name: "Top-3", color: "var(--color-series-2)", values: acc3, format: pct },
          { name: "Top-1", color: "var(--color-series-1)", values: acc1, format: pct },
        ]}
        yMin={accMin}
        yMax={1}
        yTicks={ticks(accMin, 1, 0.05)}
        yFormat={(v) => `${Math.round(v * 100)}%`}
      />
      <LineChart
        title="Training loss"
        xs={xs}
        series={[{ name: "Loss", color: "var(--color-series-1)", values: loss, format: (v) => v.toFixed(2) }]}
        yMin={lossMin}
        yMax={lossMax}
        yTicks={ticks(lossMin, lossMax, 0.2)}
        yFormat={(v) => v.toFixed(1)}
      />
    </div>
  );
}
