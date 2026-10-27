// Light / dark theme logic. The theme is a "dark" class on <html>:
// with the class, globals.css swaps every color token to its dark value.
//
// - First visit: follow the system setting (prefers-color-scheme).
// - After the user clicks the toggle: remember the choice in localStorage.
// - THEME_INIT_SCRIPT runs in <head> before the page paints, so there is
//   never a flash of the wrong theme.
//
// Used by components/ThemeToggle.tsx and app/layout.tsx.

export type Theme = "light" | "dark";

/** localStorage key for the user's choice. */
export const THEME_STORAGE_KEY = "theme";

/** How long the smooth color change lasts. Keep in sync with globals.css. */
const TRANSITION_MS = 300;

/**
 * Reads the saved choice. Returns null if there is none, or if storage is
 * blocked (some private modes throw an error when you touch localStorage).
 */
export function getStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Returns the theme the operating system / browser asks for. */
export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Returns the theme that is showing right now (read from <html>). */
export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Puts a theme on the page. With `animate`, colors fade for a moment
 * instead of switching in one hard flash.
 */
export function applyTheme(theme: Theme, animate = false): void {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (animate && !reduceMotion) {
    // The "theme-transition" class turns on color transitions for every
    // element (see globals.css). We remove it afterwards so it does not slow
    // down other animations, like the guess bars.
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS);
  }

  root.classList.toggle("dark", theme === "dark");
  // Tells the browser too, so scrollbars and form controls match.
  root.style.colorScheme = theme;
}

/** Saves the user's choice and applies it with a smooth fade. */
export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is blocked. The theme still changes, it just is not remembered.
  }
  applyTheme(theme, true);
}

/**
 * Tiny script for <head>. It runs before the first paint and sets the
 * "dark" class, so a dark-mode visitor never sees a white flash.
 * It is a plain string because it must run before React and our bundle load.
 */
export const THEME_INIT_SCRIPT = `(function () {
  var theme = null;
  try {
    theme = localStorage.getItem("${THEME_STORAGE_KEY}");
  } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  root.style.colorScheme = theme;
})();`;
