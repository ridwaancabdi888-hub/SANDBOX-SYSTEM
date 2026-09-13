import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivityServer } from "@/lib/services/activity";
import type { AppRole } from "@/lib/types/domain";

const VALID_ROLES: AppRole[] = ["admin", "cashier", "kitchen", "waiter"];

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = body?.role as AppRole;

  if (!fullName || !email || !password || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer(admin, {
    userId: guard.user.id,
    action: "user_created",
    entityType: "profile",
    entityId: data.user.id,
    description: `Created ${role} account for ${fullName} (${email})`,
  });

  return NextResponse.json({ id: data.user.id });
}
