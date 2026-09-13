"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Clock, ChefHat, PackageCheck, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { advanceOrderStatus } from "@/lib/services/orders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { timeAgo, cn } from "@/lib/utils";
import type { OrderWithItems, OrderStatus } from "@/lib/types/domain";

const COLUMNS: { status: OrderStatus; title: string; icon: typeof Clock; accent: string }[] = [
  { status: "NEW", title: "New Orders", icon: Clock, accent: "border-t-blue-500" },
  { status: "PREPARING", title: "Preparing", icon: ChefHat, accent: "border-t-amber-500" },
  { status: "READY", title: "Ready for Pickup", icon: PackageCheck, accent: "border-t-green-500" },
];

export function KitchenBoard({ initialOrders }: { initialOrders: OrderWithItems[] }) {
  const orders = useRealtimeOrders(initialOrders, ["NEW", "PREPARING", "READY"]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useConfirm();

  const byStatus = useMemo(() => {
    const map: Record<OrderStatus, OrderWithItems[]> = {
      NEW: [],
      PREPARING: [],
      READY: [],
      SERVED: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    for (const o of orders) map[o.status]?.push(o);
    for (const key of Object.keys(map) as OrderStatus[]) {
      map[key].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [orders]);

  async function handleAdvance(order: OrderWithItems, next: OrderStatus) {
    setBusyId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, next);
      toast.success(`Order #${order.order_number} moved to ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(order: OrderWithItems) {
    const ok = await confirm({
      title: `Cancel order #${order.order_number}?`,
      description: "This will restore any deducted stock. This cannot be undone.",
      confirmLabel: "Cancel order",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, "CANCELLED", "Cancelled by kitchen");
      toast.success(`Order #${order.order_number} cancelled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <span className="text-sm text-muted-foreground">
          {orders.length} active order{orders.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <col.icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">{col.title}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {byStatus[col.status].length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {byStatus[col.status].length === 0 && (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  No orders
                </div>
              )}
              {byStatus[col.status].map((order) => (
                <Card
                  key={order.id}
                  className={cn("border-t-4 p-4", col.accent)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold">#{order.order_number}</div>
                      <div className="text-sm font-medium text-muted-foreground">
                        {order.location?.name ?? order.source.replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {timeAgo(order.created_at)}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="font-medium">
                          {item.quantity}x {item.product_name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.items.some((i) => i.note) && (
                    <div className="mt-2 space-y-1">
                      {order.items
                        .filter((i) => i.note)
                        .map((i) => (
                          <div
                            key={i.id}
                            className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                          >
                            {i.product_name}: {i.note}
                          </div>
                        ))}
                    </div>
                  )}

                  {order.customer_note && (
                    <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                      NOTE: {order.customer_note}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {col.status === "NEW" && (
                      <Button
                        size="lg"
                        className="flex-1"
                        loading={busyId === order.id}
                        onClick={() => handleAdvance(order, "PREPARING")}
                      >
                        Start Preparing
                      </Button>
                    )}
                    {col.status === "PREPARING" && (
                      <Button
                        size="lg"
                        variant="success"
                        className="flex-1"
                        loading={busyId === order.id}
                        onClick={() => handleAdvance(order, "READY")}
                      >
                        Mark Ready
                      </Button>
                    )}
                    {col.status === "READY" && (
                      <div className="flex-1 rounded-lg bg-green-50 py-2 text-center text-sm font-medium text-green-700">
                        Waiting for waiter…
                      </div>
                    )}
                    {col.status !== "READY" && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleCancel(order)}
                        disabled={busyId === order.id}
                        aria-label="Cancel order"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <EmptyState
          title="No active orders"
          description="New orders from QR customers, waiters, or the cashier will appear here instantly."
        />
      )}
    </div>
  );
}
