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
import { cn } from "@/lib/utils";
import { useT, usePlural, orderStatusKey, orderSourceKey } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import type { OrderWithItems, OrderStatus, OrderSource } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

const COLUMNS: {
  status: OrderStatus;
  titleKey: TranslationKey;
  icon: typeof Clock;
  accent: string;
}[] = [
  { status: "NEW", titleKey: "kitchen.newOrders", icon: Clock, accent: "border-t-blue-500" },
  { status: "PREPARING", titleKey: "kitchen.preparing", icon: ChefHat, accent: "border-t-amber-500" },
  { status: "READY", titleKey: "kitchen.readyForPickup", icon: PackageCheck, accent: "border-t-green-500" },
];

export function KitchenBoard({ initialOrders }: { initialOrders: OrderWithItems[] }) {
  const orders = useRealtimeOrders(initialOrders, ["NEW", "PREPARING", "READY"]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useConfirm();
  const t = useT();
  const plural = usePlural();

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
      toast.success(
        t("kitchen.statusChanged", {
          number: order.order_number,
          status: t(orderStatusKey(next)),
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("kitchen.statusFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(order: OrderWithItems) {
    const ok = await confirm({
      title: t("orders.confirmCancelTitle"),
      description: t("kitchen.confirmCancelBody"),
      confirmLabel: t("kitchen.cancelOrder"),
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, "CANCELLED", "Cancelled by kitchen");
      toast.success(t("orders.cancelled", { number: order.order_number }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.cancelFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("kitchen.title")}</h1>
        <span className="text-sm text-muted-foreground">
          {plural("kitchen.activeOrders", orders.length)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <col.icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">{t(col.titleKey)}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {byStatus[col.status].length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {byStatus[col.status].length === 0 && (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  {t("kitchen.noOrders")}
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
                        {order.location?.name ?? t(orderSourceKey(order.source as OrderSource))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <LocalDateTime value={order.created_at} relative />
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
                            className="rounded-md bg-warning-bg px-2 py-1 text-xs font-medium text-warning"
                          >
                            {i.product_name}: {i.note}
                          </div>
                        ))}
                    </div>
                  )}

                  {order.customer_note && (
                    <div className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-xs font-medium text-warning">
                      {t("kitchen.note")}: {order.customer_note}
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
                        {t("kitchen.startPreparing")}
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
                        {t("kitchen.markReady")}
                      </Button>
                    )}
                    {col.status === "READY" && (
                      <div className="flex-1 rounded-lg bg-success-bg py-2 text-center text-sm font-medium text-success">
                        {t("kitchen.waitingForWaiter")}
                      </div>
                    )}
                    {col.status !== "READY" && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => handleCancel(order)}
                        disabled={busyId === order.id}
                        aria-label={t("kitchen.cancelOrder")}
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
          title={t("kitchen.allClear")}
          description={t("kitchen.allClearHint")}
        />
      )}
    </div>
  );
}
