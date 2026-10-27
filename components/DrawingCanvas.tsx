"use client";

// The square drawing board. Works with mouse, touch and pen (pointer events).
// The user draws black lines on white. Every stroke is also saved as a list
// of points, and lib/preprocess.ts builds the model input from those points.
//
// Usage: <DrawingCanvas onChange={(strokes, reason) => ...} overlay={<AttentionHeatmap ... />} />

import { useCallback, useEffect, useRef, useState } from "react";
import BrushPicker from "./BrushPicker";
import { BRUSH_SIZES, DEFAULT_BRUSH, loadBrushSize, saveBrushSize, type BrushSize } from "@/lib/brush";
import type { ChangeReason } from "@/lib/usePredictor";
import type { Point, Stroke } from "@/lib/types";

/** Largest size of the canvas on screen, in CSS pixels. */
const MAX_SIZE = 400;

interface DrawingCanvasProps {
  /** Called when the drawing changes, with all strokes and the reason. */
  onChange: (strokes: readonly Stroke[], reason: ChangeReason) => void;
  /** Drawn on top of the canvas, the same size (for example the heatmap). */
  overlay?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Canvas with drawing, Undo, Clear and a brush size picker.
 * Points are stored from 0 to 1, so strokes can be redrawn sharply at any
 * size (for example when the phone rotates).
 */
export default function DrawingCanvas({ onChange, overlay, disabled = false }: DrawingCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const sizeRef = useRef(0);
  const [cssSize, setCssSize] = useState(0);
  const [brush, setBrush] = useState<BrushSize>(DEFAULT_BRUSH);

  // Read the saved brush size after the first render. Reading localStorage
  // during render would make the server HTML and the browser HTML differ.
  useEffect(() => setBrush(loadBrushSize()), []);

  const chooseBrush = (size: BrushSize) => {
    setBrush(size);
    saveBrushSize(size);
  };

  /** Gets the 2D context of the visible canvas. */
  const getContext = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  /** Draws one stroke (or the newest piece of it) onto the canvas. */
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, from = 0) => {
    const size = sizeRef.current;
    const width = stroke.width * size;
    const { points } = stroke;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (points.length === 1) {
      // A single tap: draw a dot, so short taps still show up.
      ctx.beginPath();
      ctx.arc(points[0].x * size, points[0].y * size, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    const start = Math.max(0, from - 1);
    ctx.moveTo(points[start].x * size, points[start].y * size);
    for (let i = start + 1; i < points.length; i++) ctx.lineTo(points[i].x * size, points[i].y * size);
    ctx.stroke();
  }, []);

  /** Paints the canvas white and draws every saved stroke again. */
  const redraw = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    const size = sizeRef.current;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
  }, [drawStroke, getContext]);

  // Keep the canvas sized to its container, and sharp on high-DPI screens:
  // the real pixel count is the CSS size times devicePixelRatio.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const resize = () => {
      // Minus 4 px for the 2 px frame on each side.
      const size = Math.min(MAX_SIZE, Math.floor(wrapper.clientWidth)) - 4;
      const dpr = window.devicePixelRatio || 1;
      if (size === sizeRef.current && canvas.width === Math.round(size * dpr)) return;
      sizeRef.current = size;
      setCssSize(size);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      // Draw in CSS pixels; the transform scales up to real pixels.
      getContext()?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [getContext, redraw]);

  /** Converts a pointer position to a point from 0 to 1 on the canvas. */
  const toPoint = (clientX: number, clientY: number, rect: DOMRect): Point => ({
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || activePointerRef.current !== null) return;
    // Only the main mouse button draws.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    activePointerRef.current = e.pointerId;
    // Keep getting events even if the pointer leaves the canvas mid-stroke.
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const stroke: Stroke = { points: [toPoint(e.clientX, e.clientY, rect)], width: BRUSH_SIZES[brush] };
    strokesRef.current.push(stroke);
    const ctx = getContext();
    if (ctx) drawStroke(ctx, stroke);
    onChange(strokesRef.current, "draw");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const from = stroke.points.length;
    const rect = e.currentTarget.getBoundingClientRect();
    // Coalesced events give the extra points the browser saw between frames,
    // which makes fast strokes smooth instead of jagged.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    if (events.length > 0) {
      for (const ev of events) stroke.points.push(toPoint(ev.clientX, ev.clientY, rect));
    } else {
      stroke.points.push(toPoint(e.clientX, e.clientY, rect));
    }
    const ctx = getContext();
    if (ctx) drawStroke(ctx, stroke, from);
    onChange(strokesRef.current, "draw");
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    onChange(strokesRef.current, "strokeEnd");
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redraw();
    onChange(strokesRef.current, "undo");
  };

  const handleClear = () => {
    strokesRef.current = [];
    redraw();
    onChange(strokesRef.current, "clear");
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div ref={wrapperRef} className="flex w-full justify-center">
        {/* The frame is a wrapper, not a border on the canvas, so the canvas
            pixels and the overlay line up exactly. Only the frame follows the
            theme: the drawing itself is always black on white for the model. */}
        <div className="rounded-2xl border-2 border-line bg-white shadow-sm">
          <div className="relative overflow-hidden rounded-[14px]" style={{ width: cssSize, height: cssSize }}>
            <canvas
              ref={canvasRef}
              aria-label="Drawing area. Draw with your mouse, finger or pen."
              role="img"
              // touch-action: none stops the page from scrolling while you draw.
              className={`block h-full w-full touch-none select-none ${disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {overlay}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={handleUndo} disabled={disabled} className="btn-secondary">
          Undo
        </button>
        <button type="button" onClick={handleClear} disabled={disabled} className="btn-secondary">
          Clear
        </button>
        <BrushPicker value={brush} onChange={chooseBrush} />
      </div>
    </div>
  );
}
