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

/**
 * Deletes a staff account.
 *
 * Business history is deliberately preserved: `orders.created_by`,
 * `payments.cashier_id`, `order_status_history.changed_by`,
 * `inventory_transactions.user_id`, `expenses.created_by` and
 * `activity_logs.user_id` are all ON DELETE SET NULL, so the rows survive with
 * an anonymous actor rather than disappearing with the person. Only
 * `notifications` cascades, which is right — those are that user's inbox.
 *
 * `profiles` has no foreign key to `auth.users`, so both rows must be removed
 * explicitly. The auth row goes first: that is what actually revokes access, so
 * if the second step fails the account is already locked out rather than still
 * usable.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { id } = await params;

  if (id === guard.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // The system must never be left without a way in.
  if (target.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true)
      .neq("id", id);

    if (!count) {
      return NextResponse.json(
        { error: "This is the last active admin. Promote another admin before deleting this one." },
        { status: 400 }
      );
    }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await logActivityServer(admin, {
    userId: guard.user.id,
    action: "user_deleted",
    entityType: "profile",
    entityId: id,
    description: `Deleted ${target.role} account for ${target.full_name}`,
  });

  return NextResponse.json({ ok: true });
}
