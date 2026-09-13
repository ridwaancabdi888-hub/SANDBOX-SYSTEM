import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { PaymentsTable } from "./payments-table";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const { data: payments } = await supabase
    .from("payments")
    .select("*, order:orders(order_number), cashier:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">Payments</h1>
      <PaymentsTable payments={payments ?? []} currency={settings.currency} />
    </div>
  );
}
