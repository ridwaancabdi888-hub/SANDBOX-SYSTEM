"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Bell, Volume2, VolumeX, CheckCheck } from "lucide-react";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { usePlural, useT } from "@/lib/i18n";
import type { Notification } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

export function NotificationBell({
  initial,
  showSoundToggle,
}: {
  initial: Notification[];
  showSoundToggle?: boolean;
}) {
  const { notifications, unreadCount, markRead, markAllRead, soundEnabled, toggleSound } =
    useNotifications(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = `${panelId}-title`;
  const t = useT();
  const plural = usePlural();
  const triggerLabel = unreadCount > 0
    ? `${t("notifications.title")}: ${plural("notifications.unreadCount", unreadCount)}`
    : t("notifications.title");

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted touch:min-h-11 touch:min-w-11"
        aria-label={triggerLabel}
        aria-controls={panelId}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border p-3">
            <span id={headingId} className="font-semibold text-sm">{t("notifications.title")}</span>
            <div className="flex items-center gap-1">
              {showSoundToggle && (
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted touch:min-h-11 touch:min-w-11"
                  title={soundEnabled ? t("notifications.muteSound") : t("notifications.enableSound")}
                  aria-label={soundEnabled ? t("notifications.muteSound") : t("notifications.enableSound")}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted touch:min-h-11 touch:min-w-11"
                  title={t("notifications.markAllRead")}
                  aria-label={t("notifications.markAllRead")}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted",
                    !n.read && "bg-brand-50/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </div>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                  <span className="text-[10px] text-muted-foreground"><LocalDateTime value={n.created_at} relative /></span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
