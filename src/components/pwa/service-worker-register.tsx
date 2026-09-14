"use client";

import { useEffect } from "react";
import { startInstallCapture } from "@/lib/pwa/install";
import { SERVICE_WORKER_URL } from "@/lib/pwa/config";

// Capture the install event at module load, before any component mounts:
// Chromium can fire it before the login form has hydrated.
startInstallCapture();

/**
 * Registers the service worker once, in production only. A worker in `next dev`
 * would cache hot-reloaded chunks and serve stale code.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failing only costs installability and the offline page;
        // the app itself keeps working, so this must never surface as an error.
      });
  }, []);

  return null;
}
