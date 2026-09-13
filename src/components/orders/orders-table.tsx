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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PaymentModal } from "@/components/cashier/payment-modal";
import { ReprintReceiptModal } from "@/components/cashier/reprint-receipt-modal";
import { ORDER_STATUS_LABELS } from "@/lib/types/domain";
import type { OrderWithItems, OrderStatus } from "@/lib/types/domain";
import type { PrinterProfile, ReceiptSettings } from "@/lib/printing";

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

  const orders = useRealtimeOrders(fetched, null);

  const runSearch = useCallback(async (f: OrderFilters) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const results = await searchOrders(supabase, f);
      setFetched(results);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(filters), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function handleCancel(order: OrderWithItems) {
    const ok = await confirm({
      title: `Cancel order #${order.order_number}?`,
      description: "This restores any deducted stock. This cannot be undone.",
      confirmLabel: "Cancel order",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, "CANCELLED", "Cancelled by staff");
      toast.success("Order cancelled");
      runSearch(filters);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order #..."
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
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {loading && orders.length === 0 ? (
        <PageLoading />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders found" description="Try adjusting your search or filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((order) => (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">#{order.order_number}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {order.location?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {order.source.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatCurrency(Number(order.total), currency)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewOrder(order)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {showPayAction &&
                          !["COMPLETED", "CANCELLED"].includes(order.status) && (
                            <Button size="sm" onClick={() => setPayOrder(order)}>
                              Pay
                            </Button>
                          )}
                        {receiptContext && order.status === "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Reprint receipt"
                            onClick={() => setReprintOrderId(order.id)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {showAdminActions &&
                          !["COMPLETED", "CANCELLED"].includes(order.status) && (
                            <Button variant="outline" size="sm" onClick={() => handleCancel(order)}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? `Order #${viewOrder.order_number}` : ""}
        size="sm"
      >
        {viewOrder && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={viewOrder.status} />
              <span className="text-sm text-muted-foreground">
                {formatDateTime(viewOrder.created_at)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {viewOrder.location?.name ?? "No location"} · {viewOrder.source.replace("_", " ")}
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
                  {i.note && <div className="text-xs italic text-amber-700">Note: {i.note}</div>}
                </div>
              ))}
              {viewOrder.customer_note && (
                <div className="mt-2 border-t border-border pt-2 text-xs italic text-amber-700">
                  Order note: {viewOrder.customer_note}
                </div>
              )}
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
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
