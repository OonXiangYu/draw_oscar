"use client";

// React hook for the "Where is the AI looking?" heatmap.
//
// It runs the occlusion test (lib/occlusion.ts) once for a drawing. The result
// holds probabilities for every class, so switching which class we explain is
// instant and needs no new model call.

import { useEffect, useMemo, useState } from "react";
import { heatmapFor, runOcclusion, type OcclusionResult } from "./occlusion";
import type { InputTransform, ModelView } from "./types";

export interface Heatmap {
  /** 784 values from 0 to 1, or null when there is nothing to show. */
  values: Float32Array | null;
  /** Maps canvas points to 28x28 coordinates, so the overlay lines up. */
  transform: InputTransform | null;
  /** How long the model took for the last heatmap, in ms. */
  ms: number | null;
  /** True while a new heatmap is being computed. */
  computing: boolean;
}

/**
 * Computes the heatmap for `source` when `enabled`, and explains `classIndex`.
 * In: what the model saw, the class to explain, on/off. Out: the heatmap.
 */
export function useHeatmap(source: ModelView | null, classIndex: number | null, enabled: boolean): Heatmap {
  const [result, setResult] = useState<{ source: ModelView; occlusion: OcclusionResult } | null>(null);
  const [computing, setComputing] = useState(false);

  // Recompute only when the drawing (source) changes or the toggle turns on.
  // `source` changes at pen lift and undo, never on every move while drawing.
  useEffect(() => {
    if (!source) {
      setResult(null);
      return;
    }
    if (!enabled) return;
    let cancelled = false;
    setComputing(true);
    runOcclusion(source.input)
      .then((occlusion) => {
        if (!cancelled) setResult({ source, occlusion });
      })
      .catch((err: unknown) => console.error("Heatmap failed", err))
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, enabled]);

  const values = useMemo(
    () => (result && classIndex !== null ? heatmapFor(result.occlusion, classIndex) : null),
    [result, classIndex],
  );

  return {
    values: enabled ? values : null,
    transform: result?.source.transform ?? null,
    ms: result?.occlusion.ms ?? null,
    computing: enabled && computing,
  };
}
