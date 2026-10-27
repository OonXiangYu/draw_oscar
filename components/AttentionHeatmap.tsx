"use client";

// Draws the "Where is the AI looking?" heatmap on top of the drawing.
// It is a second canvas, exactly over DrawingCanvas, that ignores the mouse
// (pointer-events: none) so drawing still works through it.
//
// The heatmap is 28x28, in model coordinates. We use the transform from
// lib/preprocess.ts in reverse to put it back over the right part of the
// drawing, then let the browser upscale it smoothly.
//
// Usage: <DrawingCanvas overlay={<AttentionHeatmap heatmap={values} transform={t} />} />

import { useEffect, useRef } from "react";
import { INPUT_SIZE } from "@/lib/model";
import type { InputTransform } from "@/lib/types";

/** The most see-through the hottest spot can be, so the drawing stays visible. */
const MAX_ALPHA = 0.7;

/** Below this importance we draw nothing, so faint noise does not tint the canvas. */
const MIN_VALUE = 0.08;

/**
 * Colormap: transparent -> yellow -> red.
 * In: importance from 0 to 1. Out: [red, green, blue, alpha] from 0 to 255.
 */
function heatColor(v: number): [number, number, number, number] {
  if (v < MIN_VALUE) return [0, 0, 0, 0];
  // Green goes down from 220 (yellow) to 30 (red) as importance goes up.
  const green = Math.round(220 - 190 * v);
  const alpha = Math.round(255 * MAX_ALPHA * Math.min(1, v * 1.4));
  return [240, green, 20, alpha];
}

interface AttentionHeatmapProps {
  /** 784 importance values from 0 to 1, or null to show nothing. */
  heatmap: Float32Array | null;
  transform: InputTransform | null;
}

export default function AttentionHeatmap({ heatmap, transform }: AttentionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** Paints the heatmap at the canvas' current size. */
    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!heatmap || !transform || size === 0) return;

      // Step 1: color the 28x28 values into a tiny image.
      const small = document.createElement("canvas");
      small.width = INPUT_SIZE;
      small.height = INPUT_SIZE;
      const smallCtx = small.getContext("2d")!;
      const image = smallCtx.createImageData(INPUT_SIZE, INPUT_SIZE);
      for (let i = 0; i < heatmap.length; i++) image.data.set(heatColor(heatmap[i]), i * 4);
      smallCtx.putImageData(image, 0, 0);

      // Step 2: undo the preprocessing transform. A 28x28 point (u, v) came
      // from canvas point ((u - offsetX) / scale, (v - offsetY) / scale), with
      // canvas points from 0 to 1. So the whole 28x28 box starts at
      // -offset / scale and is 28 / scale wide, times the canvas size in pixels.
      const px = canvas.width;
      const left = (-transform.offsetX / transform.scale) * px;
      const top = (-transform.offsetY / transform.scale) * px;
      const width = (INPUT_SIZE / transform.scale) * px;

      // Smooth upscaling plus a small blur turn the blocky 28x28 grid into
      // soft blobs. (Browsers without canvas filters just skip the blur.)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = `blur(${Math.round((width / INPUT_SIZE) * 0.6)}px)`;
      ctx.drawImage(small, left, top, width, width);
      ctx.filter = "none";
    };

    paint();
    // Repaint when the canvas changes size (window resize, phone rotation).
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [heatmap, transform]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${heatmap ? "opacity-100" : "opacity-0"}`}
    />
  );
}
