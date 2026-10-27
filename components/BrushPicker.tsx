// Segmented bar with three brush sizes: Thin, Medium, Thick.
// Each option is drawn as a dot of that size, so it is clear without reading.
//
// Usage: <BrushPicker value={brush} onChange={setBrush} />

import { BRUSH_ORDER, BRUSH_SIZES, type BrushSize } from "@/lib/brush";

const NAMES: Record<BrushSize, string> = { thin: "Thin", medium: "Medium", thick: "Thick" };

interface BrushPickerProps {
  value: BrushSize;
  onChange: (size: BrushSize) => void;
}

export default function BrushPicker({ value, onChange }: BrushPickerProps) {
  return (
    <div role="radiogroup" aria-label="Brush size" className="flex rounded-full border border-line bg-surface p-0.5">
      {BRUSH_ORDER.map((size) => {
        const selected = size === value;
        // Dot size: the brush width at a 280 px canvas, a bit scaled down to fit.
        const dot = Math.round(BRUSH_SIZES[size] * 280 * 0.75);
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${NAMES[size]} brush`}
            title={`${NAMES[size]} brush`}
            onClick={() => onChange(size)}
            className={`flex h-9 w-10 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
              selected ? "bg-surface-2" : "hover:bg-surface-2/60"
            }`}
          >
            <span
              className={`rounded-full ${selected ? "bg-ink" : "bg-ink-3"}`}
              style={{ width: dot, height: dot }}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
