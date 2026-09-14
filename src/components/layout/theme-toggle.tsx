"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/hooks/use-theme";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const OPTIONS: { value: Theme; labelKey: TranslationKey; icon: typeof Sun }[] = [
  { value: "light", labelKey: "settings.themeLight", icon: Sun },
  { value: "dark", labelKey: "settings.themeDark", icon: Moon },
  { value: "system", labelKey: "settings.themeSystem", icon: Monitor },
];

/**
 * Segmented Light / Dark / System control.
 *
 * The selected pill is only rendered once `isClient` is true: the stored
 * preference lives in localStorage, so the server has no way to render the
 * right one and marking it during SSR would be a hydration mismatch.
 */
export function ThemeToggle({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const t = useT();

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.theme")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1",
        className
      )}
    >
      {OPTIONS.map(({ value, labelKey, icon: Icon }) => {
        const active = isClient && theme === value;
        const label = t(labelKey);
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
              "touch:min-h-11 touch:px-4",
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
            <span className={size === "sm" ? "hidden sm:inline" : ""}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Single-button cycle for the dashboard header, where the segmented control
 * would crowd the bar. Every role gets this — a kitchen screen needs dark mode
 * as much as the admin does, and only the admin can reach Settings.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const t = useT();

  const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const nameFor = (value: Theme) =>
    t(OPTIONS.find((o) => o.value === value)!.labelKey);
  // Before hydration the stored theme is unknown, so name the control rather
  // than describe a transition we cannot yet predict.
  const label = isClient
    ? t("settings.themeToggleTo", { current: nameFor(theme), next: nameFor(next) })
    : t("settings.theme");

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground",
        "touch:min-h-11 touch:min-w-11",
        className
      )}
    >
      {isClient ? <Icon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
    </button>
  );
}
