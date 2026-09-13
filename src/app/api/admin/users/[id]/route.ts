import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivityServer } from "@/lib/services/activity";
import type { AppRole } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database.types";

const VALID_ROLES: AppRole[] = ["admin", "cashier", "kitchen", "waiter"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const admin = createAdminClient();

  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (typeof body?.fullName === "string" && body.fullName.trim()) {
    updates.full_name = body.fullName.trim();
  }
  if (typeof body?.role === "string") {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (id === guard.user.id && body.role !== "admin") {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }
    updates.role = body.role as AppRole;
  }
  if (typeof body?.active === "boolean") {
    if (id === guard.user.id && body.active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }
    updates.active = body.active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer(admin, {
    userId: guard.user.id,
    action: "user_updated",
    entityType: "profile",
    entityId: id,
    description: `Updated ${data.full_name}: ${Object.keys(updates).join(", ")}`,
  });

  return NextResponse.json(data);
}
