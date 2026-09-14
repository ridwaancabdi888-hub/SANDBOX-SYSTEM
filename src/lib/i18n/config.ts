/**
 * Locale identity and persistence.
 *
 * Unlike theme, language is a **cookie**, not localStorage. Theme only toggles
 * a CSS class, so a pre-paint script can correct it before React ever runs.
 * Language changes rendered *text*, so the server has to know the choice at
 * render time — otherwise every page would hydrate against markup written in
 * the other language. A cookie is the one device-local store the server can
 * read. Every page in this app is already `force-dynamic`, so reading it costs
 * nothing extra.
 */
export const LOCALES = ["en", "so"] as const;

export type Locale = (typeof LOCALES)[number];

/** Existing installations have no cookie, and they were built in English. */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "sandbox_lang";

/** A year: a language choice should outlive a shift, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  so: "Somali",
};

/** Shown next to the label in switchers. Somali is Latin script, so this is
 *  decoration only — see `dir` below, which stays LTR for both. */
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  so: "🇸🇴",
};

/** Both languages use Latin script, so the document direction never changes. */
export const LOCALE_DIR = "ltr" as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
