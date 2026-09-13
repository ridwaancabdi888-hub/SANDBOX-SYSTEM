import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

export async function getActivityLogs(supabase: Client, limit = 200) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*, user:profiles(id, full_name, role)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Server-only: writes an activity log entry using the service-role client.
 * Used from API routes performing privileged actions (user management, etc.)
 * that don't go through the order-workflow SQL functions. The service role
 * bypasses RLS, so callers must already have verified admin access.
 */
export async function logActivityServer(
  admin: Client,
  params: { userId: string | null; action: string; entityType?: string; entityId?: string; description: string }
) {
  await admin.from("activity_logs").insert({
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    description: params.description,
  });
}
