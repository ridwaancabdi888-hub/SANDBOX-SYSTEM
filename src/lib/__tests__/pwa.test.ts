import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

import manifest from "../../app/manifest";
import { platformFor } from "../pwa/install";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const ORIGIN = "https://sandbox-cafeteria.vercel.app";

/** Width and height straight from a PNG's IHDR chunk. */
function pngSize(file: string): { w: number; h: number } {
  const buf = readFileSync(file);
  assert.equal(buf.toString("ascii", 1, 4), "PNG", `${file} is not a PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("web app manifest", () => {
  const m = manifest();

  test("identifies the app as SANDBOX", () => {
    assert.equal(m.name, "SANDBOX");
    assert.equal(m.short_name, "SANDBOX");
    assert.equal(m.description, "SANDBOX Cafeteria Management System");
  });

  test("installs as a standalone app rooted at /", () => {
    assert.equal(m.display, "standalone");
    assert.equal(m.start_url, "/");
    assert.equal(m.scope, "/");
    assert.match(String(m.theme_color), /^#[0-9a-f]{6}$/i);
    assert.match(String(m.background_color), /^#[0-9a-f]{6}$/i);
  });

  test("declares 192 and 512 icons, for both any and maskable", () => {
    const icons = m.icons ?? [];
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        assert.ok(
          icons.some((i) => i.sizes === size && i.purpose === purpose),
          `missing ${size} ${purpose} icon`
        );
      }
    }
  });

  test("every declared icon exists and really has its declared size", () => {
    for (const icon of manifest().icons ?? []) {
      const file = join(ROOT, "public", icon.src);
      assert.ok(existsSync(file), `${icon.src} does not exist`);
      const { w, h } = pngSize(file);
      assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} is ${w}x${h}`);
    }
  });

  test("favicon and Apple touch icon replace the Next.js defaults", () => {
    const apple = pngSize(join(SRC, "app", "apple-icon.png"));
    assert.deepEqual(apple, { w: 180, h: 180 });
    const ico = readFileSync(join(SRC, "app", "favicon.ico"));
    assert.equal(ico.readUInt16LE(2), 1, "favicon.ico is not an icon file");
    assert.ok(ico.readUInt16LE(4) >= 2, "favicon.ico should carry several sizes");
  });

  test("every favicon.ico frame is an RGBA PNG (the Next.js build rejects anything else)", () => {
    const ico = readFileSync(join(SRC, "app", "favicon.ico"));
    const count = ico.readUInt16LE(4);
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const offset = ico.readUInt32LE(entry + 12);
      assert.equal(ico.toString("ascii", offset + 1, offset + 4), "PNG", `frame ${i} is not PNG`);
      // IHDR colour type lives at byte 25 of a PNG; 6 = truecolour with alpha.
      assert.equal(ico.readUInt8(offset + 25), 6, `frame ${i} is not RGBA`);
    }
  });
});

describe("service worker caching rules", () => {
  // Load the real public/sw.js in a sandbox and call its routing function.
  const source = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
  const context: Record<string, unknown> = {
    URL,
    self: { addEventListener() {}, location: { origin: ORIGIN } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const strategyFor = context.strategyFor as (
    req: { method: string; mode: string; url: string; headers?: { get(n: string): string | null } },
    origin: string
  ) => string;

  const get = (path: string, mode = "cors", headers: Record<string, string> = {}) =>
    strategyFor(
      { method: "GET", mode, url: path.startsWith("http") ? path : ORIGIN + path, headers: { get: (n) => headers[n] ?? null } },
      ORIGIN
    );

  test("caches only immutable build assets and app icons", () => {
    assert.equal(get("/_next/static/chunks/app-abc123.js"), "cache-first");
    assert.equal(get("/_next/static/css/abc123.css"), "cache-first");
    assert.equal(get("/icons/icon-192.png"), "cache-first");
  });

  test("never caches pages — they always come from the network", () => {
    for (const page of ["/login", "/admin", "/admin/payments", "/cashier/orders", "/kitchen", "/order/abc"]) {
      assert.equal(get(page, "navigate"), "network-only", page);
    }
  });

  test("never touches private data: API routes, RSC payloads, mutations", () => {
    assert.equal(get("/api/admin/users"), "passthrough");
    assert.equal(get("/admin/payments?_rsc=1a2b"), "passthrough");
    assert.equal(get("/admin", "cors", { RSC: "1" }), "passthrough");
    assert.equal(strategyFor({ method: "POST", mode: "cors", url: ORIGIN + "/api/admin/users" }, ORIGIN), "passthrough");
    assert.equal(strategyFor({ method: "DELETE", mode: "cors", url: ORIGIN + "/_next/static/x.js" }, ORIGIN), "passthrough");
  });

  test("never intercepts Supabase (REST, Auth, Storage, Realtime)", () => {
    const supabase = "https://vtiqetlsjjbspchocoqw.supabase.co";
    for (const path of ["/rest/v1/orders?select=*", "/auth/v1/token?grant_type=password", "/storage/v1/object/public/branding/logo/x.png", "/realtime/v1/websocket"]) {
      assert.equal(get(supabase + path), "passthrough", path);
    }
  });

  test("a query string disqualifies an asset from the cache", () => {
    assert.equal(get("/_next/static/chunks/app.js?dpl=123"), "passthrough");
  });

  test("old caches are cleared on activate and precache holds nothing private", () => {
    assert.match(source, /caches\.delete/);
    const precache = source.match(/PRECACHE_URLS = \[([^\]]*)\]/)?.[1] ?? "";
    assert.ok(!/\/api|\/admin|\/cashier|\/kitchen|\/waiter|\/login/.test(precache), "precache contains an app page");
  });

  test("the offline page is fully static", () => {
    const html = readFileSync(join(ROOT, "public", "offline.html"), "utf8");
    assert.ok(!/<script\b[^>]*src=/i.test(html), "offline page loads external scripts");
    assert.ok(!/supabase|fetch\(/i.test(html), "offline page fetches data");
  });
});

describe("PWA wiring", () => {
  test("middleware does not run auth on the PWA files", () => {
    const mw = readFileSync(join(ROOT, "middleware.ts"), "utf8");
    const pattern = mw.match(/"(\/\(\(\?!.*?\))"/)?.[1];
    assert.ok(pattern, "matcher not found");
    const matcher = new RegExp("^" + pattern.replace(/\\\\/g, "\\") + "$");
    for (const skipped of ["/sw.js", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/favicon.ico", "/apple-icon.png"]) {
      assert.ok(!matcher.test(skipped), `${skipped} still goes through auth middleware`);
    }
    for (const guarded of ["/admin", "/cashier/orders", "/login"]) {
      assert.ok(matcher.test(guarded), `${guarded} no longer goes through middleware`);
    }
  });

  test("the service worker is registered from the root layout, production only", () => {
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    assert.match(layout, /<ServiceWorkerRegister \/>/);
    const reg = readFileSync(join(SRC, "components", "pwa", "service-worker-register.tsx"), "utf8");
    assert.match(reg, /NODE_ENV !== "production"/);
    assert.match(reg, /updateViaCache: "none"/);
  });

  test("sw.js is served without HTTP caching", () => {
    const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    assert.match(config, /source: "\/sw\.js"/);
    assert.match(config, /no-cache, no-store, must-revalidate/);
  });

  test("login shows Install App and still has no language selector", () => {
    const login = readFileSync(join(SRC, "app", "login", "page.tsx"), "utf8");
    assert.match(login, /<InstallAppButton \/>/);
    assert.ok(!/LanguageToggle|language-toggle/.test(login), "language selector is back on the login page");
    const button = readFileSync(join(SRC, "components", "pwa", "install-app-button.tsx"), "utf8");
    assert.ok(!/LanguageToggle|useSetLocale/.test(button), "install button switches language");
  });
});

describe("install platform detection", () => {
  const cases: [string, string, number, ReturnType<typeof platformFor>][] = [
    ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", 5, "ios"],
    ["iPhone Chrome", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1", 5, "ios"],
    ["iPadOS (desktop UA)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", 5, "ios"],
    ["macOS Safari", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", 0, "safari-mac"],
    ["macOS Chrome", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", 0, null],
    ["Android Firefox", "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0", 5, "android-menu"],
    ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36", 5, null],
    ["Windows Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0", 0, null],
    ["Windows Firefox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0", 0, null],
  ];
  for (const [name, ua, touch, expected] of cases) {
    test(`${name} -> ${expected ?? "native prompt or hidden"}`, () => {
      assert.equal(platformFor(ua, touch), expected);
    });
  }
});
