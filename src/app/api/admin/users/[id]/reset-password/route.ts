import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivityServer } from "@/lib/services/activity";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const newPassword = String(body?.newPassword ?? "");

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: newPassword });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivityServer(admin, {
    userId: guard.user.id,
    action: "user_password_reset",
    entityType: "profile",
    entityId: id,
    description: "Password reset by admin",
  });

  return NextResponse.json({ ok: true });
}
