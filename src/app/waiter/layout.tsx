import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecentNotifications } from "@/lib/services/notifications";
import { getSettings } from "@/lib/services/settings";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active || !["waiter", "admin"].includes(profile.role))
    redirect("/login");

  const [notifications, settings] = await Promise.all([
    getRecentNotifications(supabase),
    getSettings(supabase),
  ]);

  return (
    <ConfirmProvider>
      <DashboardShell
        role={profile.role as "waiter" | "admin"}
        section="waiter"
        fullName={profile.full_name}
        notifications={notifications}
        cafeteriaName={settings.cafeteria_name}
        logoUrl={settings.logo_url}
        showSoundToggle
      >
        {children}
      </DashboardShell>
    </ConfirmProvider>
  );
}
