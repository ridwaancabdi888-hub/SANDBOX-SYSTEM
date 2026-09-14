"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { downloadCsv } from "@/lib/utils/csv";
import { formatCurrency } from "@/lib/utils";
import { useT, paymentMethodKey } from "@/lib/i18n";
import type { PaymentMethod } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

interface PaymentRow {
  id: string;
  method: string;
  amount: number;
  amount_paid: number;
  change_amount: number;
  created_at: string;
  order: { order_number: number } | null;
  cashier: { full_name: string } | null;
}

export function PaymentsTable({ payments, currency }: { payments: PaymentRow[]; currency: string }) {
  const t = useT();
  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  function exportCsv() {
    downloadCsv(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      payments.map((p) => ({
        order_number: p.order?.order_number ?? "",
        method: p.method,
        amount: Number(p.amount),
        amount_paid: Number(p.amount_paid),
        change: Number(p.change_amount),
        cashier: p.cashier?.full_name ?? "",
        date: p.created_at,
      }))
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t("payments.summary", {
            count: payments.length,
            total: formatCurrency(total, currency),
          })}
        </span>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
          <Download className="h-4 w-4" /> {t("reports.exportCsv")}
        </Button>
      </div>

      {payments.length === 0 ? (
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
                  <td className="px-3 py-2 font-medium">#{p.order?.order_number}</td>
                  <td className="px-3 py-2">{t(paymentMethodKey(p.method as PaymentMethod))}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.amount), currency)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.amount_paid), currency)}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(p.change_amount), currency)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.cashier?.full_name ?? "—"}</td>
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
