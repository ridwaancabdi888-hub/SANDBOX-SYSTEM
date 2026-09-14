"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LOCALES,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  useLocale,
  useSetLocale,
  useT,
  type Locale,
} from "@/lib/i18n";

/**
 * Segmented English / Somali control for Settings.
 *
 * Note the difference from `ThemeToggle`: that one cannot mark the selected
 * pill until `isClient`, because the preference is in localStorage and the
 * server cannot know it. Locale arrives from the server via the cookie, so the
 * right pill is already correct in the first HTML — no flicker, no gate.
 */
export function LanguageToggle({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.language")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1",
        className
      )}
    >
      {LOCALES.map((value) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
              "touch:min-h-11 touch:px-4",
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            <span aria-hidden>{LOCALE_FLAGS[value]}</span>
            {LOCALE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

/** The other language — with exactly two locales, "switch" is unambiguous. */
function otherLocale(current: Locale): Locale {
  return LOCALES.find((l) => l !== current) ?? current;
}

/**
 * Compact switcher for the dashboard header and the customer menu, where the
 * segmented control would eat the bar. Two languages means one button is
 * enough: it shows the language you would switch *to*.
 */
export function LanguageToggleButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const next = otherLocale(locale);
  const label = LOCALE_LABELS[next];

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground",
        "touch:min-h-11 touch:min-w-11",
        className
      )}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className={cn("text-xs font-semibold uppercase", !showLabel && "hidden sm:inline")}>
        {next}
      </span>
    </button>
  );
}

/**
 * Customer-facing pair of flag pills.
 *
 * Deliberately not the header button: a customer who has just scanned a QR
 * code has no reason to know what the current language is, so both options are
 * shown rather than "switch to the other one".
 */
export function CustomerLanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();

  return (
    <div
      role="radiogroup"
      aria-label={t("customer.language")}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-muted p-0.5", className)}
    >
      {LOCALES.map((value) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LOCALE_LABELS[value]}
            onClick={() => setLocale(value)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition-colors",
              "touch:min-h-9 touch:px-2.5",
              active ? "bg-brand-600 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span aria-hidden>{LOCALE_FLAGS[value]}</span>
            <span className="uppercase">{value}</span>
          </button>
        );
      })}
    </div>
  );
}
