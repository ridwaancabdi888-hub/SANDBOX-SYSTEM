"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

export const STORAGE_KEY = "sandbox_theme";
const CHANGE_EVENT = "sandbox:theme";

/**
 * Theme is a **device** preference, not a cafeteria setting: the counter
 * tablet in a bright servery and the manager's laptop at night want different
 * answers, and they share one admin account. Same split as printer selection —
 * definitions shared, choice local.
 */
function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Applies the resolved theme to <html>. Kept identical to the inline boot
 *  script so a later change can never disagree with the pre-paint result. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode — the choice still applies for this session.
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // `storage` fires in *other* tabs, keeping them in sync.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const getServerSnapshot = (): Theme => "system";

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  // In "system" mode the OS can change under us (sunset, manual toggle).
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const select = useCallback((next: Theme) => setTheme(next), []);

  return { theme, setTheme: select };
}
