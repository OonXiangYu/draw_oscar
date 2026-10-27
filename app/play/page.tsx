// The game page: free draw mode and the timed challenge mode.

import type { Metadata } from "next";
import PlayModes from "@/components/PlayModes";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold text-ink">Draw something</h1>
      <p className="mb-4 text-ink-2">
        Draw one of 54 things, like a sun, a house or a bicycle. Big, simple shapes work best.
      </p>
      <PlayModes />
    </div>
  );
}
