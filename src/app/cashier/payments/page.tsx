import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";
import { getT } from "@/lib/i18n/server";
import { paymentMethodKey } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

export const dynamic = "force-dynamic";

export default async function CashierPaymentsPage() {
  const t = await getT();
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const { data: payments } = await supabase
    .from("payments")
    .select("*, order:orders(order_number), cashier:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">{t("payments.history")}</h1>
      {!payments || payments.length === 0 ? (
        <EmptyState title={t("payments.empty")} description={t("payments.emptyHint")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("nav.orders")}</th>
                <th className="px-3 py-2">{t("common.method")}</th>
                <th className="px-3 py-2">{t("common.amount")}</th>
                <th className="px-3 py-2">{t("payments.paid")}</th>
                <th className="px-3 py-2">{t("payments.change")}</th>
                <th className="px-3 py-2">{t("payments.cashier")}</th>
                <th className="px-3 py-2">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">
                    #{(p.order as { order_number: number } | null)?.order_number}
                  </td>
                  <td className="px-3 py-2">{t(paymentMethodKey(p.method as PaymentMethod))}</td>
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
