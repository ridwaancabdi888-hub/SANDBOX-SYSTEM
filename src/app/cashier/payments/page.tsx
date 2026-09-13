import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";
import { PAYMENT_METHOD_LABELS } from "@/lib/types/domain";
import type { PaymentMethod } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

export const dynamic = "force-dynamic";

export default async function CashierPaymentsPage() {
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const { data: payments } = await supabase
    .from("payments")
    .select("*, order:orders(order_number), cashier:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">Payment History</h1>
      {!payments || payments.length === 0 ? (
        <EmptyState title="No payments yet" description="Completed payments will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Cashier</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">
                    #{(p.order as { order_number: number } | null)?.order_number}
                  </td>
                  <td className="px-3 py-2">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.amount), settings.currency)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.amount_paid), settings.currency)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.change_amount), settings.currency)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(p.cashier as { full_name: string } | null)?.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground"><LocalDateTime value={p.created_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
