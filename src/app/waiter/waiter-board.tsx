"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Bell, Clock, ChefHat, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { advanceOrderStatus } from "@/lib/services/orders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { useT, useI18n, orderSourceKey } from "@/lib/i18n";
import type { OrderWithItems, OrderSource } from "@/lib/types/domain";
import { LocalDateTime } from "@/components/ui/local-time";

export function WaiterBoard({ initialOrders }: { initialOrders: OrderWithItems[] }) {
  const { t } = useI18n();
  const orders = useRealtimeOrders(
    initialOrders,
    ["NEW", "PREPARING", "READY", "SERVED"],
    (event) => {
      if (event.type === "update" && event.order.status === "READY") {
        toast(t("waiter.orderReadyToast", { number: event.order.order_number }), {
          description: event.order.location?.name ?? t("waiter.readyForPickup"),
        });
      }
    }
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const ready = useMemo(
    () =>
      orders
        .filter((o) => o.status === "READY")
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
    [orders]
  );
  const inProgress = useMemo(
    () =>
      orders
        .filter((o) => o.status === "NEW" || o.status === "PREPARING")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  );
  const served = useMemo(
    () =>
      orders
        .filter((o) => o.status === "SERVED")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10),
    [orders]
  );

  async function markServed(order: OrderWithItems) {
    setBusyId(order.id);
    try {
      const supabase = createClient();
      await advanceOrderStatus(supabase, order.id, "SERVED");
      toast.success(t("waiter.served", { number: order.order_number }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("waiter.serveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-bold">{t("waiter.title")}</h1>

      <section className="mb-6">
        <SectionHeader icon={Bell} title={t("waiter.readyForPickup")} count={ready.length} accent="text-success" />
        {ready.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t("waiter.nothingReady")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((order) => (
              <Card key={order.id} className="border-2 border-success/60 bg-success-bg/40 p-4">
                <OrderSummary order={order} />
                <Button
                  size="xl"
                  variant="success"
                  className="mt-3 w-full"
                  loading={busyId === order.id}
                  onClick={() => markServed(order)}
                >
                  <CheckCircle2 className="h-5 w-5" /> {t("waiter.markServed")}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6">
        <SectionHeader icon={ChefHat} title={t("waiter.inTheKitchen")} count={inProgress.length} accent="text-warning" />
        {inProgress.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t("waiter.nothingInProgress")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map((order) => (
              <Card key={order.id} className="p-4">
                <OrderSummary order={order} />
                <div className="mt-3 rounded-lg bg-muted py-2 text-center text-xs font-medium text-muted-foreground">
                  {order.status === "NEW" ? t("waiter.waitingForKitchen") : t("waiter.beingPrepared")}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader icon={Clock} title={t("waiter.recentlyServed")} count={served.length} accent="text-muted-foreground" />
        {served.length === 0 ? (
          <EmptyState title={t("waiter.nothingServed")} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {served.map((order) => (
              <Card key={order.id} className="p-4 opacity-70">
                <OrderSummary order={order} />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  accent,
}: {
  icon: typeof Bell;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className={`h-5 w-5 ${accent}`} />
      <h2 className="font-semibold">{title}</h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{count}</span>
    </div>
  );
}

function OrderSummary({ order }: { order: OrderWithItems }) {
  const t = useT();
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">#{order.order_number}</div>
          <div className="text-sm font-medium text-muted-foreground">
            {order.location?.name ?? t(orderSourceKey(order.source as OrderSource))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground"><LocalDateTime value={order.created_at} relative /></span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}x {item.product_name}
          </li>
        ))}
      </ul>
      {order.customer_note && (
        <div className="mt-2 rounded-md bg-warning-bg px-2 py-1 text-xs font-medium text-warning">
          {t("kitchen.note")}: {order.customer_note}
        </div>
      )}
    </div>
  );
}
