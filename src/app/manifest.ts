import type { MetadataRoute } from "next";
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "../lib/pwa/config";

/**
 * Web App Manifest, served at /manifest.webmanifest and linked automatically.
 *
 * `start_url` is `/`, which already routes a signed-in user to their role's
 * home and everyone else to /login — so an installed app opens in the right
 * place for whoever is holding the device.
 *
 * Icons are static files generated from the cafeteria logo by
 * `scripts/generate-pwa-icons.mjs`. `background_color` is the logo's own
 * background, so the splash screen and maskable padding blend into the icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SANDBOX",
    short_name: "SANDBOX",
    description: "SANDBOX Cafeteria Management System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
