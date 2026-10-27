"use client";

// Switches between the two game modes on the play page.

import { useState } from "react";
import ChallengeMode from "./ChallengeMode";
import FreeDrawMode from "./FreeDrawMode";

type Mode = "free" | "challenge";

const MODES: { id: Mode; label: string }[] = [
  { id: "free", label: "Free draw" },
  { id: "challenge", label: "Challenge" },
];

export default function PlayModes() {
  const [mode, setMode] = useState<Mode>("free");

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Game mode" className="flex w-fit gap-1 rounded-full bg-surface-2 p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              mode === m.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "free" ? <FreeDrawMode /> : <ChallengeMode />}
    </div>
  );
}
