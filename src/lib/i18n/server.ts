import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "./config";
import { dictionaries, en, translate, pluralKey, type TranslationKey, type TranslationVars } from "./dictionary";

/**
 * Reads the language for this request.
 *
 * Every page in this app is already `force-dynamic`, so touching cookies costs
 * nothing. If it were not, this call is what would opt a route out of static
 * rendering — worth remembering before adding a static page.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export interface Translator {
  (key: TranslationKey, vars?: TranslationVars): string;
  locale: Locale;
  plural: (key: string, count: number, vars?: TranslationVars) => string;
}

export function translatorFor(locale: Locale): Translator {
  const dict = dictionaries[locale];
  const t = ((key: TranslationKey, vars?: TranslationVars) =>
    translate(dict, en, key, vars)) as Translator;
  t.locale = locale;
  t.plural = (key, count, vars) =>
    translate(dict, en, pluralKey(key, count), { count, ...vars });
  return t;
}

/** `t` for Server Components. Client components use `useT()` instead. */
export async function getT(): Promise<Translator> {
  return translatorFor(await getLocale());
}
