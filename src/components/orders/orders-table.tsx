"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Search, Eye, Ban, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchOrders, advanceOrderStatus, type OrderFilters } from "@/lib/services/orders";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageLoading } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils";
import { PaymentModal } from "@/components/cashier/payment-modal";
import { ReprintReceiptModal } from "@/components/cashier/reprint-receipt-modal";
import { ORDER_STATUS_FLOW } from "@/lib/types/domain";
import { useT, orderStatusKey, orderSourceKey } from "@/lib/i18n";
import type { OrderWithItems, OrderStatus, OrderSource } from "@/lib/types/domain";
import type { PrinterProfile, ReceiptSettings } from "@/lib/printing";
import { LocalDateTime } from "@/components/ui/local-time";

export function OrdersTable({
  initialOrders,
  currency,
  showPayAction,
  showAdminActions,
  receiptContext,
}: {
  initialOrders: OrderWithItems[];
  currency: string;
  showPayAction?: boolean;
  showAdminActions?: boolean;
  /** Present when this screen may take payments or reprint receipts. */
  receiptContext?: {
    settings: ReceiptSettings;
    cashierName: string;
    printers: PrinterProfile[];
  };
}) {
  const [filters, setFilters] = useState<OrderFilters>({ limit: 100 });
  const [fetched, setFetched] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [viewOrder, setViewOrder] = useState<OrderWithItems | null>(null);
  const [payOrder, setPayOrder] = useState<OrderWithItems | null>(null);
  const [reprintOrderId, setReprintOrderId] = useState<string | null>(null);
  const confirm = useConfirm();
  const t = useT();

  const orders = useRealtimeOrders(fetched, null);

  const runSearch = useCallback(async (f: OrderFilters) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const results = await searchOrders(supabase, f);
      setFetched(results);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(filters), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleCancel(order: OrderWithItems) {
    const ok = await confirm({
      title: t("orders.confirmCancelTitle"),
      description: t("orders.confirmCancelBody", { number: order.order_number }),
      confirmLabel: t("orders.cancelOrder"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, "CANCELLED", "Cancelled by staff");
      toast.success(t("orders.cancelled", { number: order.order_number }));
      runSearch(filters);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.cancelFailed"));
    }
  }

  /** The same actions in both layouts — defined once so the mobile cards and
   *  the desktop table can't drift apart. */
  function rowActions(order: OrderWithItems) {
    return (
      <>
        <Button variant="ghost" size="sm" aria-label={t("orders.viewOrder", { number: order.order_number })} onClick={() => setViewOrder(order)}>
          <Eye className="h-4 w-4" />
        </Button>
        {showPayAction && !["COMPLETED", "CANCELLED"].includes(order.status) && (
          <Button size="sm" onClick={() => setPayOrder(order)}>
            {t("orders.pay")}
          </Button>
        )}
        {receiptContext && order.status === "COMPLETED" && (
          <Button
            size="sm"
            variant="outline"
            title={t("orders.reprint")}
            aria-label={t("orders.reprintReceipt", { number: order.order_number })}
            onClick={() => setReprintOrderId(order.id)}
          >
            <Printer className="h-4 w-4" />
          </Button>
        )}
        {showAdminActions && !["COMPLETED", "CANCELLED"].includes(order.status) && (
          <Button
            variant="outline"
            size="sm"
            aria-label={t("orders.cancelOrderFor", { number: order.order_number })}
            onClick={() => handleCancel(order)}
          >
            <Ban className="h-4 w-4" />
          </Button>
        )}
      </>
    );
  }

  const sorted = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("orders.searchPlaceholder")}
            className="pl-9"
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          className="w-auto"
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              statuses: e.target.value ? [e.target.value as OrderStatus] : undefined,
            }))
          }
        >
          <option value="">{t("orders.allStatuses")}</option>
          {ORDER_STATUS_FLOW.concat("CANCELLED").map((value) => (
            <option key={value} value={value}>
              {t(orderStatusKey(value))}
            </option>
          ))}
        </Select>
      </div>

      {loading && orders.length === 0 ? (
        <PageLoading label={t("common.loading")} />
      ) : orders.length === 0 ? (
        <EmptyState title={t("orders.empty")} description={t("orders.emptyHint")} />
      ) : (
        <>
          {/* Below `sm` the seven columns push Total, Time and the action
              buttons off-screen behind a horizontal scroll — the actions are
              the whole point of this screen, so phones get cards instead. */}
          <ul className="space-y-2 sm:hidden">
            {sorted.map((order) => (
              <li key={order.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">#{order.order_number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.location?.name ?? t("newOrder.noLocation")} ·{" "}
                      {t(orderSourceKey(order.source as OrderSource))}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {formatCurrency(Number(order.total), currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <LocalDateTime value={order.created_at} />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1.5 border-t border-border pt-2">
                  {rowActions(order)}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("nav.orders")}</th>
                <th className="px-3 py-2">{t("common.location")}</th>
                <th className="px-3 py-2">{t("orders.source")}</th>
                <th className="px-3 py-2">{t("common.status")}</th>
                <th className="px-3 py-2">{t("common.total")}</th>
                <th className="px-3 py-2">{t("common.time")}</th>
                <th className="px-3 py-2 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((order) => (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">#{order.order_number}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {order.location?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t(orderSourceKey(order.source as OrderSource))}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatCurrency(Number(order.total), currency)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <LocalDateTime value={order.created_at} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">{rowActions(order)}</div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <Modal
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? t("orders.orderNumber", { number: viewOrder.order_number }) : ""}
        size="sm"
      >
        {viewOrder && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={viewOrder.status} />
              <span className="text-sm text-muted-foreground">
                <LocalDateTime value={viewOrder.created_at} />
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {viewOrder.location?.name ?? t("newOrder.noLocation")} ·{" "}
              {t(orderSourceKey(viewOrder.source as OrderSource))}
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              {viewOrder.items.map((i) => (
                <div key={i.id} className="mb-1">
                  <div className="flex justify-between">
                    <span>
                      {i.quantity}x {i.product_name}
                    </span>
                    <span>{formatCurrency(Number(i.subtotal), currency)}</span>
                  </div>
                  {i.note && (
                    <div className="text-xs italic text-warning">
                      {t("common.note")}: {i.note}
                    </div>
                  )}
                </div>
              ))}
              {viewOrder.customer_note && (
                <div className="mt-2 border-t border-border pt-2 text-xs italic text-warning">
                  {t("orders.customerNote")}: {viewOrder.customer_note}
                </div>
              )}
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{t("common.total")}</span>
              <span>{formatCurrency(Number(viewOrder.total), currency)}</span>
            </div>
          </div>
        )}
      </Modal>

      {receiptContext && (
        <>
          <PaymentModal
            order={payOrder}
            open={!!payOrder}
            onClose={() => setPayOrder(null)}
            onPaid={() => runSearch(filters)}
            settings={receiptContext.settings}
            cashierName={receiptContext.cashierName}
            printers={receiptContext.printers}
          />
          <ReprintReceiptModal
            orderId={reprintOrderId}
            open={!!reprintOrderId}
            onClose={() => setReprintOrderId(null)}
            fallbackCashierName={receiptContext.cashierName}
            settings={receiptContext.settings}
            printers={receiptContext.printers}
          />
        </>
      )}
    </div>
  );
}
