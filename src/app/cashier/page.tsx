import { createClient } from "@/lib/supabase/server";
import { getAvailableProductsByCategory } from "@/lib/services/menu";
import { getActiveLocations } from "@/lib/services/locations";
import { getSettings } from "@/lib/services/settings";
import { getPrinterProfiles } from "@/lib/services/printers";
import { getOrdersByStatuses } from "@/lib/services/orders";
import { CashierPos } from "./cashier-pos";

export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const [categories, locations, settings, printers, pendingOrders] = await Promise.all([
    getAvailableProductsByCategory(supabase),
    getActiveLocations(supabase),
    getSettings(supabase),
    getPrinterProfiles(supabase),
    getOrdersByStatuses(supabase, ["NEW", "PREPARING", "READY", "SERVED"], {
      ascending: false,
      limit: 100,
    }),
  ]);

  return (
    <CashierPos
      categories={categories}
      locations={locations}
      settings={settings}
      cashierName={profile?.full_name ?? "Cashier"}
      initialOrders={pendingOrders}
      printers={printers}
    />
  );
}
