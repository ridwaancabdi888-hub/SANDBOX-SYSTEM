/*
 * SANDBOX service worker.
 *
 * Its job is to make the app installable and to start fast — NOT to make
 * private data available offline. Every screen in SANDBOX shows data scoped to
 * the signed-in user by Supabase RLS (orders, payments, staff, admin reports),
 * so a cached page could show one person's data to the next person holding the
 * device. The rules below make that impossible by construction:
 *
 *   - Only immutable, content-hashed build output (/_next/static/) and the app
 *     icons are ever cached. They are identical for every user.
 *   - Pages (navigations) are always fetched from the network and never stored.
 *     If the network is down, a static offline page is shown instead.
 *   - Everything else passes straight through: RSC payloads, /api/*, auth
 *     cookies, and all cross-origin traffic — Supabase REST, Auth, Storage and
 *     the Realtime websocket are never intercepted.
 *
 * `strategyFor` is a pure function so these rules are unit-tested
 * (src/lib/__tests__/pwa.test.ts).
 */

const CACHE_VERSION = "sandbox-static-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

/**
 * @param {{ method: string, mode: string, url: string, headers?: { get(name: string): string | null } }} request
 * @param {string} origin the service worker's own origin
 * @returns {"passthrough" | "network-only" | "cache-first"}
 */
function strategyFor(request, origin) {
  if (request.method !== "GET") return "passthrough";

  const url = new URL(request.url);
  if (url.origin !== origin) return "passthrough"; // Supabase, fonts CDN, etc.

  // Page loads: never cached. Falls back to the offline page only on failure.
  if (request.mode === "navigate") return "network-only";

  // Client-side navigation payloads carry per-user data.
  if (url.searchParams.has("_rsc")) return "passthrough";
  if (request.headers && request.headers.get("RSC")) return "passthrough";

  if (url.search === "" && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    return "cache-first";
  }

  return "passthrough";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.location.origin);

  if (strategy === "network-only") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((offline) => offline || Response.error())
      )
    );
    return;
  }

  if (strategy === "cache-first") {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(event.request).then(
          (cached) =>
            cached ||
            fetch(event.request).then((response) => {
              // Only store complete, same-origin successes.
              if (response.ok && response.type === "basic") cache.put(event.request, response.clone());
              return response;
            })
        )
      )
    );
  }

  // "passthrough": do not call respondWith — the browser handles it normally.
});
