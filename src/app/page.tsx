import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/domain";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen",
  waiter: "/waiter",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile ? ROLE_HOME[profile.role as AppRole] : "/login");
}
