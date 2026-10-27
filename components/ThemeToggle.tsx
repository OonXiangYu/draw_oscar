"use client";

// Round button in the nav bar that switches between light and dark theme.
// Light theme shows a sun, dark theme shows a moon. When clicked, the old icon
// spins and fades out while the new one spins in.
//
// Which icon shows is decided by CSS (the `dark:` variant), not by React
// state. So the right icon is there from the first paint, even before React
// loads, and the server HTML always matches.

import { useEffect, useState } from "react";
import { getCurrentTheme, getStoredTheme, getSystemTheme, setTheme, applyTheme, type Theme } from "@/lib/theme";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// Shared icon classes: both icons sit on top of each other in the button.
const ICON = "absolute inset-0 flex items-center justify-center transition duration-300 ease-out motion-reduce:transition-none";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Only used for the aria-label. Null until we can read the page on the client.
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(getCurrentTheme());

    // While the user has not picked a theme, keep following the system
    // setting if it changes (for example automatic dark mode at night).
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getStoredTheme() !== null) return;
      const next = getSystemTheme();
      applyTheme(next, true);
      setThemeState(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const toggle = () => {
    const next: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : theme === "light" ? "Switch to dark theme" : "Switch theme"}
      className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-line text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <span className={`${ICON} rotate-0 scale-100 opacity-100 dark:-rotate-90 dark:scale-50 dark:opacity-0`}>
        <SunIcon />
      </span>
      <span className={`${ICON} rotate-90 scale-50 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100`}>
        <MoonIcon />
      </span>
    </button>
  );
}
