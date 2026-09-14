import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { en } from "../i18n/locales/en";
import { so } from "../i18n/locales/so";
import {
  allKeys,
  callableKeys,
  pluralBaseKeys,
  lookup,
  translate,
  pluralKey,
  onMissingKey,
  resetMissingKeys,
  type Dictionary,
} from "../i18n/dictionary";
import { LOCALES, DEFAULT_LOCALE, isLocale, normalizeLocale } from "../i18n/config";

/**
 * The type system already guarantees `so` has every key `en` does — this file
 * covers what types cannot: that the *values* are sane, that every key a
 * component asks for exists, and that placeholders survive translation.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full) && !full.includes("__tests__")) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({
  path: f.slice(SRC.length + 1).replace(/\\/g, "/"),
  text: readFileSync(f, "utf8"),
}));

const DICTS: Record<string, Dictionary> = { en, so: so as Dictionary };
const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

describe("i18n locales", () => {
  test("every configured locale has a dictionary", () => {
    for (const locale of LOCALES) {
      assert.ok(DICTS[locale], `no dictionary for ${locale}`);
    }
    assert.equal(DEFAULT_LOCALE, "en", "existing installations must default to English");
  });

  test("locales declare exactly the same keys", () => {
    const enKeys = allKeys().sort();
    const soKeys: string[] = [];
    for (const [section, entries] of Object.entries(so)) {
      for (const name of Object.keys(entries)) soKeys.push(`${section}.${name}`);
    }
    soKeys.sort();
    const missingInSo = enKeys.filter((k) => !soKeys.includes(k));
    const extraInSo = soKeys.filter((k) => !enKeys.includes(k));
    assert.deepEqual(missingInSo, [], "keys missing from Somali");
    assert.deepEqual(extraInSo, [], "keys in Somali that English does not declare");
  });

  test("no translation is blank", () => {
    const blank: string[] = [];
    for (const [locale, dict] of Object.entries(DICTS)) {
      for (const key of allKeys()) {
        const value = lookup(dict, key);
        if (!value || !value.trim()) blank.push(`${locale}:${key}`);
      }
    }
    assert.deepEqual(blank, []);
  });

  test("placeholders survive translation", () => {
    // A dropped {number} silently renders "Order #" with nothing after it.
    const mismatched: string[] = [];
    for (const key of allKeys()) {
      const source = placeholders(lookup(en, key)!);
      for (const [locale, dict] of Object.entries(DICTS)) {
        if (locale === "en") continue;
        const target = placeholders(lookup(dict, key)!);
        if (source.join(",") !== target.join(",")) {
          mismatched.push(`${locale}:${key} (${source.join("|")} vs ${target.join("|")})`);
        }
      }
    }
    assert.deepEqual(mismatched, []);
  });

  test("every plural key has both a one and an other form", () => {
    const incomplete: string[] = [];
    for (const base of pluralBaseKeys()) {
      for (const [locale, dict] of Object.entries(DICTS)) {
        for (const form of ["one", "other"]) {
          if (lookup(dict, `${base}_${form}`) === undefined) {
            incomplete.push(`${locale}:${base}_${form}`);
          }
        }
      }
    }
    assert.deepEqual(incomplete, []);
  });

  test("Somali is actually translated, not copied English", () => {
    // A handful of high-traffic keys. If these ever match English the locale
    // file has been regenerated from the wrong source.
    const mustDiffer = [
      "nav.orders",
      "nav.settings",
      "common.save",
      "common.cancel",
      "roles.cashier",
      "orderStatus.READY",
      "newOrder.placeOrder",
      "kitchen.startPreparing",
      "waiter.markServed",
    ];
    for (const key of mustDiffer) {
      assert.notEqual(lookup(so as Dictionary, key), lookup(en, key), `${key} is still English`);
    }
  });
});

describe("i18n database safety", () => {
  // Translating a stored enum would break advance_order_status / record_payment.
  // These check the *display* layer covers every stored value, so a label can
  // never be missing, while the values themselves stay untouched.
  const cases: [string, string[]][] = [
    ["roles", ["admin", "cashier", "kitchen", "waiter"]],
    ["orderStatus", ["NEW", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]],
    ["orderSource", ["QR", "CASHIER", "WAITER"]],
    ["paymentMethods", ["CASH", "ZAAD", "EDAHAB", "OTHER"]],
    ["units", ["kg", "g", "L", "ml", "pcs", "box", "pack"]],
  ];

  for (const [section, values] of cases) {
    test(`${section} has a label for every stored value`, () => {
      for (const value of values) {
        for (const [locale, dict] of Object.entries(DICTS)) {
          assert.ok(
            lookup(dict, `${section}.${value}`),
            `${locale} is missing ${section}.${value}`
          );
        }
      }
    });
  }

  test("payment method and role keys keep their database casing", () => {
    // `paymentMethods.CASH`, not `paymentMethods.cash` — the key mirrors the
    // enum so `paymentMethodKey(row.method)` can never miss.
    assert.ok(lookup(en, "paymentMethods.CASH"));
    assert.equal(lookup(en, "paymentMethods.cash"), undefined);
    assert.ok(lookup(en, "roles.cashier"));
    assert.equal(lookup(en, "roles.CASHIER"), undefined);
  });
});

describe("i18n usage in components", () => {
  /** Every literal key passed to t(...) or plural(...) across the source. */
  function usedKeys(): { key: string; file: string; plural: boolean }[] {
    const out: { key: string; file: string; plural: boolean }[] = [];
    for (const { path, text } of FILES) {
      if (path.startsWith("lib/i18n/")) continue;
      for (const m of text.matchAll(/\bt\(\s*"([a-zA-Z]+\.[a-zA-Z0-9_]+)"/g)) {
        out.push({ key: m[1], file: path, plural: false });
      }
      for (const m of text.matchAll(/\bplural\(\s*"([a-zA-Z]+\.[a-zA-Z0-9_]+)"/g)) {
        out.push({ key: m[1], file: path, plural: true });
      }
      for (const m of text.matchAll(/(?:labelKey|titleKey|blurbKey|platformsKey):\s*"([a-zA-Z]+\.[a-zA-Z0-9_]+)"/g)) {
        out.push({ key: m[1], file: path, plural: false });
      }
    }
    return out;
  }

  test("every key a component asks for exists in both locales", () => {
    const missing: string[] = [];
    for (const { key, file, plural } of usedKeys()) {
      for (const [locale, dict] of Object.entries(DICTS)) {
        const found = plural
          ? lookup(dict, `${key}_one`) && lookup(dict, `${key}_other`)
          : lookup(dict, key);
        if (!found) missing.push(`${locale}:${key} (${file})`);
      }
    }
    assert.deepEqual(missing, []);
  });

  test("components do not call t() with a plural base key directly", () => {
    // t("orders.itemCount") would resolve to nothing — plural bases only exist
    // as _one / _other.
    const bases = new Set(pluralBaseKeys());
    const wrong = usedKeys().filter((u) => !u.plural && bases.has(u.key));
    assert.deepEqual(wrong.map((w) => `${w.key} (${w.file})`), []);
  });

  test("the locale provider wraps the application", () => {
    const layout = FILES.find((f) => f.path === "app/layout.tsx");
    assert.ok(layout, "root layout not found");
    assert.match(layout!.text, /<LocaleProvider/, "LocaleProvider is not mounted");
    assert.match(layout!.text, /getLocale\(\)/, "layout does not read the locale cookie");
    assert.match(layout!.text, /lang=\{locale\}/, "<html lang> is not driven by the locale");
  });

  test("both languages stay left-to-right", () => {
    // Somali uses Latin script; an RTL switch here would be a regression.
    const config = readFileSync(join(SRC, "lib", "i18n", "config.ts"), "utf8");
    assert.match(config, /LOCALE_DIR\s*=\s*"ltr"/);
    const layout = FILES.find((f) => f.path === "app/layout.tsx")!;
    assert.match(layout.text, /dir=\{LOCALE_DIR\}/);
    assert.ok(!/dir="rtl"/.test(layout.text));
  });

  test("the sidebar labels come from the dictionary", () => {
    const nav = FILES.find((f) => f.path === "components/layout/nav-items.ts");
    assert.ok(nav);
    assert.match(nav!.text, /labelKey: "nav\./);
    assert.ok(!/\blabel: "/.test(nav!.text), "a nav item still has a hardcoded label");
  });
});

describe("translate()", () => {
  test("fills placeholders", () => {
    assert.equal(
      translate(en, en, "orders.orderNumber", { number: 1042 }),
      "Order #1042"
    );
    assert.equal(
      translate(so as Dictionary, en, "orders.orderNumber", { number: 1042 }),
      "Dalab #1042"
    );
  });

  test("leaves an unknown placeholder visible rather than blanking it", () => {
    assert.equal(translate(en, en, "orders.orderNumber", {}), "Order #{number}");
  });

  test("picks the plural form by count", () => {
    assert.equal(pluralKey("orders.itemCount", 1), "orders.itemCount_one");
    assert.equal(pluralKey("orders.itemCount", 3), "orders.itemCount_other");
    assert.equal(
      translate(en, en, pluralKey("orders.itemCount", 1), { count: 1 }),
      "1 item"
    );
    assert.equal(
      translate(en, en, pluralKey("orders.itemCount", 4), { count: 4 }),
      "4 items"
    );
  });

  test("falls back to English when a locale lacks the key", () => {
    const partial = { ...en, common: { ...en.common } } as unknown as Dictionary;
    delete (partial.common as unknown as Record<string, string>).save;
    assert.equal(translate(partial, en, "common.save"), "Save");
  });

  test("reports a missing key instead of rendering the raw path", () => {
    resetMissingKeys();
    const seen: string[] = [];
    onMissingKey((k) => seen.push(k));
    const rendered = translate(en, en, "nope.notAKey");
    onMissingKey(null);
    resetMissingKeys();
    assert.deepEqual(seen, ["nope.notAKey"]);
    assert.equal(rendered, "notAKey", "a user should never see the dotted key");
  });
});

describe("locale config", () => {
  test("recognises supported locales only", () => {
    assert.ok(isLocale("en"));
    assert.ok(isLocale("so"));
    assert.ok(!isLocale("fr"));
    assert.ok(!isLocale(undefined));
  });

  test("normalises anything unexpected to English", () => {
    assert.equal(normalizeLocale("so"), "so");
    assert.equal(normalizeLocale("fr"), "en");
    assert.equal(normalizeLocale(undefined), "en");
    assert.equal(normalizeLocale(""), "en");
  });

  test("callableKeys excludes plural variants", () => {
    const callable = callableKeys();
    assert.ok(callable.includes("orders.title"));
    assert.ok(!callable.some((k) => k.endsWith("_one") || k.endsWith("_other")));
  });
});
