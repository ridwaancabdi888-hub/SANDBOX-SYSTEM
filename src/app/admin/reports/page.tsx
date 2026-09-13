import { createClient } from "@/lib/supabase/server";
import {
  getSalesReport,
  getTopProducts,
  getCashierPerformance,
  getStaffActivityCounts,
} from "@/lib/services/reports";
import { getSettings } from "@/lib/services/settings";
import { ReportsView } from "./reports-view";

export const dynamic = "force-dynamic";

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const range = { from: startOfTodayIso(), to: new Date().toISOString() };

  const [report, topProducts, cashierPerf, waiterActivity, kitchenActivity, settings] =
    await Promise.all([
      getSalesReport(supabase, range),
      getTopProducts(supabase, range, 10),
      getCashierPerformance(supabase, range),
      getStaffActivityCounts(supabase, range, "SERVED"),
      getStaffActivityCounts(supabase, range, "READY"),
      getSettings(supabase),
    ]);

  return (
    <ReportsView
      initialReport={report}
      initialTopProducts={topProducts}
      initialCashierPerf={cashierPerf}
      initialWaiterActivity={waiterActivity}
      initialKitchenActivity={kitchenActivity}
      currency={settings.currency}
    />
  );
}
