"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./config";
import {
  dictionaries,
  en,
  pluralKey,
  translate,
  type TranslationKey,
  type TranslationVars,
} from "./dictionary";

interface LocaleContextValue {
  locale: Locale;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  plural: (key: string, count: number, vars?: TranslationVars) => string;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Seeded by the server from the cookie, so the first client render uses the
 * same language the server just rendered. That is what keeps language changes
 * free of hydration mismatches — there is no "read localStorage on mount and
 * swap the text" step for React to disagree about.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();

  const value = useMemo<LocaleContextValue>(() => {
    const dict = dictionaries[locale] ?? en;
    return {
      locale,
      t: (key, vars) => translate(dict, en, key, vars),
      plural: (key, count, vars) =>
        translate(dict, en, pluralKey(key, count), { count, ...vars }),
      setLocale: (next: Locale) => {
        // A plain cookie, not localStorage: the server renders the text, so it
        // has to be able to read the choice on the next request.
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
        document.documentElement.lang = next;
        // Re-render server components with the new locale. `refresh()` keeps
        // client state (an in-progress order, an open modal) intact, which a
        // full reload would throw away.
        router.refresh();
      },
    };
  }, [locale, router]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  // A client component rendered outside the provider still has to produce
  // text. English is the documented default, so fall back rather than throw.
  return {
    locale: DEFAULT_LOCALE,
    t: (key, vars) => translate(en, en, key, vars),
    plural: (key, count, vars) =>
      translate(en, en, pluralKey(key, count), { count, ...vars }),
    setLocale: () => {},
  };
}

/** The common case: `const t = useT()` then `t("orders.title")`. */
export function useT() {
  return useLocaleContext().t;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useSetLocale() {
  return useLocaleContext().setLocale;
}

/** `plural("orders.itemCount", n)` → "3 items" / "1 item". */
export function usePlural() {
  return useLocaleContext().plural;
}

/** Everything at once, for components that need more than `t`. */
export function useI18n(): LocaleContextValue {
  return useLocaleContext();
}
