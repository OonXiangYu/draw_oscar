"use client";

// The square drawing board. Works with mouse, touch and pen (pointer events).
// The user draws black lines on white; lib/preprocess.ts later turns that into
// the white-on-black 28x28 image the model wants.
//
// Usage: <DrawingCanvas onChange={(canvas, final) => ...} onClear={() => ...} />

import { useCallback, useEffect, useRef } from "react";

type Point = [x: number, y: number];

/** Brush width as a share of the canvas width (14 px on a 280 px canvas). */
const BRUSH_RATIO = 14 / 280;

/** Largest size of the canvas on screen, in CSS pixels. */
const MAX_SIZE = 400;

interface DrawingCanvasProps {
  /** Called when the drawing changes. `final` is true when a stroke ends. */
  onChange: (canvas: HTMLCanvasElement, final: boolean) => void;
  /** Called when the user clears the canvas. */
  onClear?: () => void;
  disabled?: boolean;
}

/**
 * Canvas with drawing, Clear and Undo.
 * Strokes are stored as points from 0 to 1, so they can be redrawn sharply
 * at any size (for example when the phone rotates).
 */
export default function DrawingCanvas({ onChange, onClear, disabled = false }: DrawingCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activePointerRef = useRef<number | null>(null);
  const sizeRef = useRef(0);

  /** Gets the 2D context, set up for drawing round black lines. */
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    // willReadFrequently: preprocess() reads the pixels many times per second.
    return canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
  }, []);

  /** Draws one stroke (or the newest piece of it) onto the canvas. */
  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Point[], from = 0) => {
      const size = sizeRef.current;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      ctx.lineWidth = size * BRUSH_RATIO;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.length === 1) {
        // A single tap: draw a dot, so short taps still count as ink.
        const [x, y] = stroke[0];
        ctx.beginPath();
        ctx.arc(x * size, y * size, (size * BRUSH_RATIO) / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      const start = Math.max(0, from - 1);
      ctx.moveTo(stroke[start][0] * size, stroke[start][1] * size);
      for (let i = start + 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0] * size, stroke[i][1] * size);
      }
      ctx.stroke();
    },
    [],
  );

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
      const size = Math.min(MAX_SIZE, Math.floor(wrapper.clientWidth));
      const dpr = window.devicePixelRatio || 1;
      if (size === sizeRef.current && canvas.width === Math.round(size * dpr)) return;
      sizeRef.current = size;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
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
  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || activePointerRef.current !== null) return;
    // Only the main mouse button draws.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    activePointerRef.current = e.pointerId;
    // Keep getting events even if the pointer leaves the canvas mid-stroke.
    e.currentTarget.setPointerCapture(e.pointerId);

    const stroke: Point[] = [toPoint(e)];
    strokesRef.current.push(stroke);
    const ctx = getContext();
    if (ctx) drawStroke(ctx, stroke);
    onChange(e.currentTarget, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const from = stroke.length;
    // Coalesced events give the extra points the browser saw between frames,
    // which makes fast strokes smooth instead of jagged.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    if (events.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      for (const ev of events) {
        stroke.push([(ev.clientX - rect.left) / rect.width, (ev.clientY - rect.top) / rect.height]);
      }
    } else {
      stroke.push(toPoint(e));
    }
    const ctx = getContext();
    if (ctx) drawStroke(ctx, stroke, from);
    onChange(e.currentTarget, false);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    onChange(e.currentTarget, true);
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redraw();
    if (strokesRef.current.length === 0) onClear?.();
    else if (canvasRef.current) onChange(canvasRef.current, true);
  };

  const handleClear = () => {
    strokesRef.current = [];
    redraw();
    onClear?.();
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div ref={wrapperRef} className="flex w-full justify-center">
        <canvas
          ref={canvasRef}
          aria-label="Drawing area. Draw with your mouse, finger or pen."
          role="img"
          // touch-action: none stops the page from scrolling while you draw.
          className={`touch-none select-none rounded-2xl border-2 border-line bg-white shadow-sm ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleUndo} disabled={disabled} className="btn-secondary">
          Undo
        </button>
        <button type="button" onClick={handleClear} disabled={disabled} className="btn-secondary">
          Clear
        </button>
      </div>
    </div>
  );
}
