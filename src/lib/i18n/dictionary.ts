import { en } from "./locales/en";
import { so } from "./locales/so";
import type { Locale } from "./config";

/**
 * The shape every locale must satisfy. `en` is the source of truth, so adding
 * a key there turns every other locale file into a type error until it is
 * translated. Missing keys therefore cannot ship — `tsc` is the check.
 */
export type Dictionary = {
  readonly [S in keyof typeof en]: { readonly [K in keyof (typeof en)[S]]: string };
};

/** Every valid `t()` argument, as a literal union like "orders.title". */
export type TranslationKey = {
  [S in keyof Dictionary]: `${S & string}.${keyof Dictionary[S] & string}`;
}[keyof Dictionary];

export type TranslationVars = Record<string, string | number>;

/**
 * Keys ending in `_one` / `_other` are plural variants and are never called
 * directly — `plural()` picks between them.
 */
const PLURAL_SUFFIX = /_(one|other)$/;

/** Interpolates `{name}` placeholders. Unknown names are left untouched so a
 *  typo shows up as `{oops}` in testing rather than silently vanishing. */
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

export function lookup(dict: Dictionary, key: string): string | undefined {
  const dot = key.indexOf(".");
  if (dot < 0) return undefined;
  const section = dict[key.slice(0, dot) as keyof Dictionary];
  if (!section) return undefined;
  return (section as Record<string, string>)[key.slice(dot + 1)];
}

/**
 * Resolves a key against a locale, falling back to English and then to the key
 * itself. The fallback chain only matters for data that escaped the type
 * system (a key built at runtime); typed call sites cannot reach it.
 */
export function translate(
  dict: Dictionary,
  fallback: Dictionary,
  key: string,
  vars?: TranslationVars
): string {
  const hit = lookup(dict, key) ?? lookup(fallback, key);
  if (hit === undefined) {
    reportMissing(key);
    // Show the last segment rather than the raw dotted key: "newOrder" reads
    // like an oversight, "orders.newOrder" reads like a crash.
    return key.slice(key.lastIndexOf(".") + 1);
  }
  return interpolate(hit, vars);
}

/** Somali does not inflect a counted noun, so its `_one` and `_other` are
 *  often identical. The branch stays because English needs it. */
export function pluralKey(key: string, count: number): string {
  return `${key}_${count === 1 ? "one" : "other"}`;
}

export type MissingKeyHandler = (key: string) => void;

const missing = new Set<string>();
let handler: MissingKeyHandler | null = null;

function reportMissing(key: string) {
  if (missing.has(key)) return;
  missing.add(key);
  if (handler) handler(key);
  else if (process.env.NODE_ENV !== "production") {
    console.error(`[i18n] missing translation key: ${key}`);
  }
}

/** Test hook: collect missing keys instead of logging them. */
export function onMissingKey(fn: MissingKeyHandler | null) {
  handler = fn;
}

export function missingKeys(): string[] {
  return [...missing];
}

export function resetMissingKeys() {
  missing.clear();
}

/** Every key declared in `en`, including the `_one` / `_other` variants. */
export function allKeys(): string[] {
  const out: string[] = [];
  for (const [section, entries] of Object.entries(en)) {
    for (const name of Object.keys(entries)) out.push(`${section}.${name}`);
  }
  return out;
}

/** Keys a caller can pass to `t()` — plural variants excluded, since those are
 *  reached through `plural()` rather than named directly. */
export function callableKeys(): string[] {
  return allKeys().filter((k) => !PLURAL_SUFFIX.test(k));
}

export function pluralBaseKeys(): string[] {
  return [...new Set(allKeys().filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, "")))];
}

// `so.ts` imports `Dictionary` from this module, but as `import type`, which
// is erased at compile time — so this pair is not a runtime cycle.
export const dictionaries: Record<Locale, Dictionary> = { en, so };

export { en };
