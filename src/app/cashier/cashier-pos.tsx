"use client";

import { useState } from "react";
import { ShoppingCart, ClipboardList } from "lucide-react";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { OrderBuilder } from "@/components/orders/order-builder";
import { PaymentModal } from "@/components/cashier/payment-modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  Category,
  Product,
  Location,
  Settings,
  OrderWithItems,
} from "@/lib/types/domain";
import type { PrinterProfile } from "@/lib/printing";
import { LocalDateTime } from "@/components/ui/local-time";

export function CashierPos({
  categories,
  locations,
  settings,
  cashierName,
  initialOrders,
  printers,
}: {
  categories: (Category & { products: Product[] })[];
  locations: Location[];
  settings: Settings;
  cashierName: string;
  initialOrders: OrderWithItems[];
  printers: PrinterProfile[];
}) {
  const [tab, setTab] = useState<"new" | "pending">("new");
  const orders = useRealtimeOrders(initialOrders, ["NEW", "PREPARING", "READY", "SERVED"]);
  const [payingOrder, setPayingOrder] = useState<OrderWithItems | null>(null);

  return (
    <div className="flex flex-1 flex-col p-4 lg:p-6">
      <div className="mb-4 flex items-center gap-2">
        <TabButton active={tab === "new"} onClick={() => setTab("new")} icon={ShoppingCart}>
          New Order
        </TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")} icon={ClipboardList}>
          Awaiting Payment
          <span className="ml-1.5 rounded-full bg-current/15 px-1.5 text-xs">{orders.length}</span>
        </TabButton>
      </div>

      {tab === "new" ? (
        <OrderBuilder
          categories={categories}
          locations={locations}
          source="CASHIER"
          currency={settings.currency}
          onOrderCreated={() => setTab("pending")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.length === 0 && (
            <EmptyState
              title="No orders awaiting payment"
              description="New orders will appear here as soon as they're created."
              icon={<ClipboardList className="h-6 w-6" />}
            />
          )}
          {orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">#{order.order_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {order.location?.name ?? order.source.replace("_", " ")}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {order.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity}x {i.product_name}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground"><LocalDateTime value={order.created_at} relative /></span>
                <span className="font-bold">{formatCurrency(Number(order.total), settings.currency)}</span>
              </div>
              <Button className="mt-3 w-full" onClick={() => setPayingOrder(order)}>
                Take Payment
              </Button>
            </Card>
          ))}
        </div>
      )}

      <PaymentModal
        order={payingOrder}
        open={!!payingOrder}
        onClose={() => setPayingOrder(null)}
        settings={settings}
        cashierName={cashierName}
        printers={printers}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ShoppingCart;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors touch:min-h-11 touch:px-4",
        active ? "bg-brand-600 text-white" : "bg-muted hover:bg-muted/70"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
