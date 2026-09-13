"use client";

import { useEffect, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "@/lib/services/notifications";
import type { Notification } from "@/lib/types/domain";

const SOUND_KEY = "sandbox_notification_sound_enabled";

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const playTone = (start: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.3);
    };
    playTone(0, 880);
    playTone(0.15, 1175);
    setTimeout(() => ctx.close(), 700);
  } catch {
    // Web Audio unsupported — fail silently, notifications still show as toasts
  }
}

export function useNotifications(initial: Notification[]) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  // Read the persisted preference lazily so it's correct on first paint
  // without a follow-up state update. Guarded for SSR.
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(SOUND_KEY);
    return stored === null ? true : stored === "true";
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      // Realtime needs the user's access token, otherwise RLS runs as `anon`
      // and role-targeted notifications never reach the client.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(session?.access_token ?? null);
      if (cancelled) return;

      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            const notification = payload.new as Notification;
            setNotifications((prev) => [notification, ...prev].slice(0, 50));
            toast(notification.title, { description: notification.message });
            if (soundEnabled) {
              playBeep();
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [soundEnabled]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    const supabase = createClient();
    await markNotificationRead(supabase, id);
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const supabase = createClient();
    await Promise.all(unread.map((n) => markNotificationRead(supabase, n.id)));
  }, [notifications]);

  return { notifications, unreadCount, markRead, markAllRead, soundEnabled, toggleSound };
}
