"use client";

import { useState, useMemo, useCallback } from "react";
import { DollarSign, ClipboardList, ChefHat, Bell, CheckCircle2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSalesReport, getTopProducts, type DateRange } from "@/lib/services/reports";
import { useRealtimeOrders } from "@/lib/hooks/use-realtime-orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderWithItems, type Ingredient } from "@/lib/types/domain";

/** Most recent active orders shown inline; the rest live on the Orders page. */
const ACTIVE_ORDER_LIMIT = 8;

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-info-bg text-info",
  PREPARING: "bg-warning-bg text-warning",
  READY: "bg-success-bg text-success",
  SERVED: "bg-success-bg text-success",
};

type Report = Awaited<ReturnType<typeof getSalesReport>>;
type TopProducts = Awaited<ReturnType<typeof getTopProducts>>;

function rangeFor(preset: string): DateRange {
  const now = new Date();
  const start = new Date();
  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday": {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setDate(start.getDate() - 30);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }
  return { from: start.toISOString(), to: now.toISOString() };
}

export function AdminDashboard({
  initialReport,
  initialTopProducts,
  lowStock,
  activeOrders,
  currency,
}: {
  initialReport: Report;
  initialTopProducts: TopProducts;
  lowStock: Ingredient[];
  activeOrders: OrderWithItems[];
  currency: string;
}) {
  const [preset, setPreset] = useState("today");
  const [report, setReport] = useState(initialReport);
  const [topProducts, setTopProducts] = useState(initialTopProducts);
  const [loading, setLoading] = useState(false);
  const liveOrders = useRealtimeOrders(activeOrders, ["NEW", "PREPARING", "READY", "SERVED"]);

  const counts = useMemo(
    () => ({
      new: liveOrders.filter((o) => o.status === "NEW").length,
      preparing: liveOrders.filter((o) => o.status === "PREPARING").length,
      ready: liveOrders.filter((o) => o.status === "READY").length,
      served: liveOrders.filter((o) => o.status === "SERVED").length,
    }),
    [liveOrders]
  );

  const activeList = useMemo(
    () => liveOrders.slice(0, ACTIVE_ORDER_LIMIT),
    [liveOrders]
  );

  const handlePresetChange = useCallback(async (value: string) => {
    setPreset(value);
    setLoading(true);
    try {
      const supabase = createClient();
      const range = rangeFor(value);
      const [r, tp] = await Promise.all([
        getSalesReport(supabase, range),
        getTopProducts(supabase, range, 5),
      ]);
      setReport(r);
      setTopProducts(tp);
    } finally {
      setLoading(false);
    }
  }, []);

  const completedToday = report.byStatus.find((s) => s.status === "COMPLETED")?.count ?? 0;

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Select
          className="w-auto"
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value)}
          disabled={loading}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard icon={DollarSign} label="Sales" value={formatCurrency(report.totalSales, currency)} />
        <StatCard icon={ClipboardList} label="Orders" value={report.totalOrders} />
        <StatCard icon={ClipboardList} label="Pending" value={counts.new} accent="text-info" />
        <StatCard icon={ChefHat} label="Preparing" value={counts.preparing} accent="text-warning" />
        <StatCard icon={Bell} label="Ready" value={counts.ready} accent="text-success" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedToday} accent="text-success" />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={lowStock.length}
          accent={lowStock.length > 0 ? "text-danger" : undefined}
        />
      </div>

      {/* Charts were removed in favour of these compact breakdowns — same
          figures, a third of the vertical space, and readable on a phone.
          Full charting lives on the Reports page. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={topProducts.map((p) => ({
                key: p.name,
                label: p.name,
                value: `${p.quantity}`,
                sub: formatCurrency(p.revenue, currency),
                weight: p.quantity,
              }))}
              empty="No items sold in this period"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={report.byStatus.map((s) => ({
                key: s.status,
                label:
                  ORDER_STATUS_LABELS[s.status as keyof typeof ORDER_STATUS_LABELS] ?? s.status,
                value: `${s.count}`,
                weight: s.count,
              }))}
              empty="No orders in this period"
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList
              rows={report.byPaymentMethod.map((m) => ({
                key: m.method,
                label: m.method,
                value: formatCurrency(m.total, currency),
                sub: `${m.count} payment${m.count === 1 ? "" : "s"}`,
                weight: m.total,
              }))}
              empty="No payments in this period"
            />
          </CardContent>
        </Card>
      </div>

      {/* Takes the space the charts used to occupy, with something an admin
          can act on. `liveOrders` is already realtime-subscribed for the
          counters above, so this costs no extra query. */}
      <Card>
        <CardHeader>
          <CardTitle>Active Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {activeList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing in progress — every order is settled.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Order</th>
                    <th className="pb-2 pr-3 font-medium">Location</th>
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Items</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.map((order) => (
                    <tr key={order.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-semibold">#{order.order_number}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {order.location?.name ?? "—"}
                      </td>
                      <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">
                        {order.items.reduce((sum, i) => sum + i.quantity, 0)}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_STYLES[order.status] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {formatCurrency(Number(order.total), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {liveOrders.length > activeList.length && (
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Showing {activeList.length} of {liveOrders.length} active orders — see Orders for
                  the rest.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {lowStock.length > 0 && (
        <Card className="border-danger/30 bg-danger-bg/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-4 w-4" /> Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {lowStock.map((ing) => (
                <div key={ing.id} className="rounded-lg bg-card px-3 py-2 text-sm shadow-sm">
                  <div className="font-medium">{ing.name}</div>
                  <div className="text-xs text-danger">
                    {ing.current_quantity} / {ing.minimum_quantity} {ing.unit}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface BreakdownRow {
  key: string;
  label: string;
  value: string;
  sub?: string;
  /** Drives the proportion bar; compared against the largest row. */
  weight: number;
}

/**
 * A ranked breakdown with a proportion bar — the readable, chart-free
 * replacement for the dashboard pies. Degrades to a plain list rather than
 * collapsing when every weight is zero.
 */
function BreakdownList({ rows, empty }: { rows: BreakdownRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  const max = Math.max(...rows.map((r) => r.weight), 0);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">{row.value}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${max > 0 ? (row.weight / max) * 100 : 0}%` }}
              />
            </div>
            {row.sub && (
              <span className="shrink-0 text-xs text-muted-foreground">{row.sub}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${accent ?? ""}`} />
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </Card>
  );
}
