/**
 * Client-safe i18n surface. Server Components import `./server` instead —
 * that module is `server-only` and cannot be pulled into a client bundle.
 */
export {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  LOCALE_DIR,
  DEFAULT_LOCALE,
  isLocale,
  normalizeLocale,
  type Locale,
} from "./config";

export {
  LocaleProvider,
  useT,
  useLocale,
  useSetLocale,
  usePlural,
  useI18n,
} from "./context";

export {
  allKeys,
  callableKeys,
  pluralBaseKeys,
  dictionaries,
  lookup,
  missingKeys,
  onMissingKey,
  resetMissingKeys,
  translate,
  pluralKey,
  type Dictionary,
  type TranslationKey,
  type TranslationVars,
} from "./dictionary";

export {
  roleKey,
  orderStatusKey,
  orderSourceKey,
  paymentMethodKey,
  unitKey,
} from "./labels";
