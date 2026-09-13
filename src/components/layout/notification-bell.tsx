"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Volume2, VolumeX, CheckCheck } from "lucide-react";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-1">
              {showSoundToggle && (
                <button
                  onClick={toggleSound}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  title={soundEnabled ? "Mute sound" : "Enable sound"}
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
                  onClick={markAllRead}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  title="Mark all read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
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
