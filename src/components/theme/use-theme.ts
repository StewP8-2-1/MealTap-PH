"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./constants";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// The server can't know the theme. React uses this during hydration and then
// re-renders with the real value, so there is no hydration mismatch.
function getServerSnapshot(): ResolvedTheme {
  return "light";
}

function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark =
    preference === "dark" || (preference === "system" && prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Reads the theme that ThemeScript applied, and lets components change it. */
export function useTheme() {
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setTheme = useCallback((preference: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    applyTheme(preference);
  }, []);

  return { resolvedTheme, setTheme };
}
