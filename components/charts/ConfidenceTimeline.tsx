"use client";

// Confidence timeline: how sure the AI was after each stroke.
// x = stroke number (1, 2, 3, ...), y = confidence from 0 to 100%.
// Plain SVG in the same style as TrainingCurve. Hover or tap a stroke to see
// the exact values. The "spark" variant is a tiny version for the end screen.
//
// Usage: <ConfidenceTimeline series={[{ name: "Bicycle", color: "...", values: [0.1, 0.6] }]} />

import { useState } from "react";

export interface TimelineSeries {
  name: string;
  color: string;
  /** Confidence from 0 to 1 after each stroke. */
  values: number[];
}

interface ConfidenceTimelineProps {
  series: TimelineSeries[];
  /** Marks one stroke with a dot and a label, e.g. "Got it at stroke 3". */
  marker?: { stroke: number; label: string };
  variant?: "full" | "spark";
  title?: string;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// Sizes of the drawing area in SVG units. The SVG scales to its container.
const FULL = { w: 320, h: 160, pad: { top: 14, right: 14, bottom: 26, left: 38 } };
const SPARK = { w: 96, h: 28, pad: { top: 4, right: 4, bottom: 4, left: 4 } };

export default function ConfidenceTimeline({ series, marker, variant = "full", title }: ConfidenceTimelineProps) {
  const [hover, setHover] = useState<number | null>(null);
  const spark = variant === "spark";
  const { w: W, h: H, pad: PAD } = spark ? SPARK : FULL;
  const count = Math.max(0, ...series.map((s) => s.values.length));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  /** x position of stroke i (0-based). One stroke sits in the middle. */
  const x = (i: number) => PAD.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - v) * plotH;

  if (count === 0) {
    if (spark) return <span className="block h-7 w-24 rounded bg-surface-2" aria-label="No strokes" />;
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-center text-sm text-ink-3">
        Finish a stroke to start the timeline.
      </div>
    );
  }

  /** Finds the stroke closest to the pointer. */
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const i = count <= 1 ? 0 : Math.round(((svgX - PAD.left) / plotW) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, i)));
  };

  // Show every stroke number if they fit, otherwise every 2nd, 3rd, ...
  const labelStep = Math.ceil(count / 10);
  const markerIndex = marker ? marker.stroke - 1 : null;
  const markerValue = markerIndex !== null ? series[0]?.values[markerIndex] : undefined;

  const svg = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={spark ? "h-7 w-24 shrink-0" : "w-full touch-pan-y"}
      role="img"
      aria-label={title ?? `Confidence after each stroke: ${series.map((s) => s.name).join(", ")}`}
      onPointerMove={spark ? undefined : handleMove}
      onPointerDown={spark ? undefined : handleMove}
      onPointerLeave={spark ? undefined : () => setHover(null)}
    >
      {spark ? (
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeWidth={1} />
      ) : (
        <>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--color-ink-3)">
                {t * 100}%
              </text>
            </g>
          ))}
          {Array.from({ length: count }, (_, i) =>
            i % labelStep === 0 || i === count - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-ink-3)">
                {i + 1}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-ink-3)" strokeWidth={1} strokeDasharray="3 3" />
          )}
        </>
      )}

      {series.map((s) => (
        <g key={s.name}>
          <polyline
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={spark ? 1.5 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* In the small version, a dot on the last value. Without it a
              one-stroke drawing would show nothing, since a 1-point line is invisible. */}
          {spark && s.values.length > 0 && (
            <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r={1.75} fill={s.color} />
          )}
          {/* One dot per stroke, because each point is a real moment, not a trend. */}
          {!spark &&
            s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r={hover === i ? 4.5 : 3}
                fill={s.color}
                stroke="var(--color-surface)"
                strokeWidth={hover === i ? 2 : 1}
              />
            ))}
        </g>
      ))}

      {markerIndex !== null && markerValue !== undefined && (
        <circle
          cx={x(markerIndex)}
          cy={y(markerValue)}
          r={spark ? 2.5 : 5.5}
          fill="var(--color-good)"
          stroke="var(--color-surface)"
          strokeWidth={spark ? 1 : 2}
        />
      )}
    </svg>
  );

  if (spark) return svg;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink">{title ?? "Confidence after each stroke"}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
            {series.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded" style={{ background: s.color }} aria-hidden />
                {s.name}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="relative">
        {svg}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover >= count / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <p className="mb-0.5 font-semibold text-ink">After stroke {hover + 1}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.name}: <span className="font-semibold tabular-nums text-ink">{pct(s.values[hover] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-ink-3">
        {marker ? (
          <span className="font-medium text-good">● {marker.label}</span>
        ) : (
          "x = stroke number. Hover or tap a point for exact values."
        )}
      </p>
    </figure>
  );
}
