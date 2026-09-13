import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { getPrinterProfiles } from "@/lib/services/printers";
import { SettingsManager } from "./settings-manager";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [settings, printers] = await Promise.all([
    getSettings(supabase),
    getPrinterProfiles(supabase),
  ]);

  return <SettingsManager initialSettings={settings} printers={printers} />;
}
