import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/domain";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, profile };
}

export async function requireRole(allowedRoles: AppRole[]) {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user || !profile || !profile.active) {
    return { ok: false as const, status: 401, message: "Not authenticated" };
  }

  if (!allowedRoles.includes(profile.role as AppRole)) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  return { ok: true as const, supabase, user, profile };
}
