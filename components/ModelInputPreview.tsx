"use client";

// Shows the exact 28x28 image the model sees, scaled up with sharp pixels.
// Handy for checking the preprocessing: it should show white lines on black,
// centered and filling most of the box.
//
// Usage: <ModelInputPreview input={modelInput} />

import { useEffect, useRef } from "react";
import { INPUT_SIZE } from "@/lib/model";

interface ModelInputPreviewProps {
  /** 784 values from 0 to 1, or null when nothing is drawn. */
  input: Float32Array | null;
}

/** Draws the model input onto a tiny 28x28 canvas that CSS scales up. */
export default function ModelInputPreview({ input }: ModelInputPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(INPUT_SIZE, INPUT_SIZE);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      // Show the values as the model sees them: 0 = black, 1 = white.
      const v = Math.round((input?.[i] ?? 0) * 255);
      image.data[i * 4] = v;
      image.data[i * 4 + 1] = v;
      image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [input]);

  return (
    <figure className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={INPUT_SIZE}
        height={INPUT_SIZE}
        className="h-36 w-36 rounded-lg border border-line [image-rendering:pixelated]"
        aria-label="The 28 by 28 pixel image the model sees"
      />
      <figcaption className="max-w-48 text-center text-xs text-ink-3">
        28×28 pixels, white on black, just like the training data.
      </figcaption>
    </figure>
  );
}
