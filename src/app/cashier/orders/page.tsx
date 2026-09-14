import { createClient } from "@/lib/supabase/server";
import { searchOrders } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import { getPrinterProfiles } from "@/lib/services/printers";
import { OrdersTable } from "@/components/orders/orders-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CashierOrdersPage() {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const [orders, settings, printers] = await Promise.all([
    searchOrders(supabase, { limit: 100 }),
    getSettings(supabase),
    getPrinterProfiles(supabase),
  ]);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">{t("orders.title")}</h1>
      <OrdersTable
        initialOrders={orders}
        currency={settings.currency}
        showPayAction
        receiptContext={{
          settings,
          cashierName: profile?.full_name ?? "Cashier",
          printers,
        }}
      />
    </div>
  );
}
