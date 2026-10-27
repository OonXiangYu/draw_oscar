// The three brush sizes, and remembering the user's choice.
//
// Brush size only changes how the drawing looks on screen. The model input is
// rebuilt from the stroke points with a fixed line width (lib/preprocess.ts),
// so a thick or thin brush does not change what the model sees.

export type BrushSize = "thin" | "medium" | "thick";

/** Brush widths as a share of the canvas width: 8 / 14 / 21 px on a 280 px canvas. */
export const BRUSH_SIZES: Record<BrushSize, number> = {
  thin: 0.03,
  medium: 0.05,
  thick: 0.075,
};

export const BRUSH_ORDER: BrushSize[] = ["thin", "medium", "thick"];
export const DEFAULT_BRUSH: BrushSize = "medium";

const STORAGE_KEY = "brush-size";

/**
 * Reads the saved brush size. Falls back to Medium if there is none, or if
 * storage is blocked (some private modes throw when you touch localStorage).
 */
export function loadBrushSize(): BrushSize {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "thin" || value === "medium" || value === "thick") return value;
  } catch {
    // Storage blocked: use the default.
  }
  return DEFAULT_BRUSH;
}

/** Saves the brush size. If storage is blocked, the choice just is not remembered. */
export function saveBrushSize(size: BrushSize): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Ignore: not being remembered is fine.
  }
}
