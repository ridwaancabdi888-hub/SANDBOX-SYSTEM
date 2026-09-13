import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

export async function getRecentNotifications(supabase: Client, limit = 30) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getUnreadCount(supabase: Client) {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(supabase: Client, id: string) {
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: Client, ids: string[]) {
  await Promise.all(ids.map((id) => markNotificationRead(supabase, id)));
}
