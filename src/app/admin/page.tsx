import { createClient } from "@/lib/supabase/server";
import { getSalesReport, getTopProducts } from "@/lib/services/reports";
import { getLowStockIngredients } from "@/lib/services/inventory";
import { getOrdersByStatuses } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { AdminDashboard } from "./admin-dashboard";

export const dynamic = "force-dynamic";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AdminPage() {
  const supabase = await createClient();
  const range = { from: startOfTodayIso(), to: new Date().toISOString() };

  const [report, topProducts, lowStock, activeOrders, settings] = await Promise.all([
    getSalesReport(supabase, range),
    getTopProducts(supabase, range, 5),
    getLowStockIngredients(supabase),
    getOrdersByStatuses(supabase, ["NEW", "PREPARING", "READY", "SERVED"], { limit: 200 }),
    getSettings(supabase),
  ]);

  return (
    <AdminDashboard
      initialReport={report}
      initialTopProducts={topProducts}
      lowStock={lowStock}
      activeOrders={activeOrders}
      currency={settings.currency}
    />
  );
}
