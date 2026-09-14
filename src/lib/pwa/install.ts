"use client";

import { useSyncExternalStore } from "react";

/**
 * Install state for the "Install App" control.
 *
 * Browsers differ, and the control must not pretend otherwise:
 *
 *   - Chromium (Chrome, Edge, Samsung Internet, Android Chrome) fires
 *     `beforeinstallprompt` once the app is installable and NOT already
 *     installed. We hold on to that event and call `prompt()` on click, which
 *     opens the browser's own install dialog. If the event never fires, the
 *     app is either installed already or not installable here, so nothing is
 *     offered.
 *   - iOS / iPadOS has no install API at all. Every iOS browser installs via
 *     Share → Add to Home Screen, so we can only explain that.
 *   - Safari on macOS installs via File → Add to Dock.
 *   - Firefox on Android installs from its own menu.
 *   - Anything else (e.g. Firefox desktop) cannot install a web app, so the
 *     control stays hidden rather than showing a button that does nothing.
 *   - Running as the installed app (display-mode: standalone) hides it.
 */
export type InstallKind =
  | "pending" // server render / hydration: render nothing
  | "standalone" // already running as the installed app
  | "installed" // installed during this visit
  | "prompt" // native install dialog available
  | "ios"
  | "safari-mac"
  | "android-menu"
  | "unsupported";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Starts listening as early as possible. `beforeinstallprompt` fires once per
 * page load, sometimes before the login form hydrates, so this runs from the
 * root layout rather than from the button itself.
 */
export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress Chrome's own mini-infobar only where our button replaces it.
    // Elsewhere the browser's native affordance stays, and the stored event is
    // still usable if the user navigates to /login in the same session.
    if (window.location.pathname.startsWith("/login")) event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedThisVisit = true;
    emit();
  });

  window.matchMedia("(display-mode: standalone)").addEventListener("change", emit);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Pure platform detection, exported for tests. */
export function platformFor(userAgent: string, maxTouchPoints: number): "ios" | "safari-mac" | "android-menu" | null {
  const ua = userAgent;
  // iPadOS reports a desktop Mac user agent, but has touch.
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (iOS) return "ios";
  const chromiumFamily = /Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/.test(ua);
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !chromiumFamily && !/Firefox/.test(ua)) return "safari-mac";
  if (/Android/.test(ua) && /Firefox/.test(ua)) return "android-menu";
  return null;
}

function snapshot(): InstallKind {
  if (isStandalone()) return "standalone";
  if (installedThisVisit) return "installed";
  if (deferred) return "prompt";
  return platformFor(navigator.userAgent, navigator.maxTouchPoints ?? 0) ?? "unsupported";
}

function subscribe(listener: () => void) {
  startInstallCapture();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallKind(): InstallKind {
  return useSyncExternalStore(subscribe, snapshot, () => "pending");
}

/** Opens the native install dialog. Resolves to whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  // A prompt event can only be used once, whatever the outcome.
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installedThisVisit = true;
  emit();
  return outcome === "accepted";
}
