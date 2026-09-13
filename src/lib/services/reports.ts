import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

export interface DateRange {
  from: string;
  to: string;
}

export async function getSalesReport(supabase: Client, range: DateRange) {
  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("amount, amount_paid, method, created_at, order_id")
    .gte("created_at", range.from)
    .lte("created_at", range.to);
  if (payErr) throw payErr;

  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("id, status, source, created_at")
    .gte("created_at", range.from)
    .lte("created_at", range.to);
  if (ordErr) throw ordErr;

  const { data: expenses, error: expErr } = await supabase
    .from("expenses")
    .select("amount, expense_date")
    .gte("expense_date", range.from.slice(0, 10))
    .lte("expense_date", range.to.slice(0, 10));
  if (expErr) throw expErr;

  const totalSales = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  const byDayMap = new Map<string, number>();
  for (const p of payments ?? []) {
    const day = p.created_at.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + Number(p.amount));
  }
  const byDay = Array.from(byDayMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byMethodMap = new Map<string, { total: number; count: number }>();
  for (const p of payments ?? []) {
    const entry = byMethodMap.get(p.method) ?? { total: 0, count: 0 };
    entry.total += Number(p.amount);
    entry.count += 1;
    byMethodMap.set(p.method, entry);
  }
  const byPaymentMethod = Array.from(byMethodMap.entries()).map(([method, v]) => ({
    method,
    ...v,
  }));

  const byStatusMap = new Map<string, number>();
  for (const o of orders ?? []) {
    byStatusMap.set(o.status, (byStatusMap.get(o.status) ?? 0) + 1);
  }
  const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  const bySourceMap = new Map<string, number>();
  for (const o of orders ?? []) {
    bySourceMap.set(o.source, (bySourceMap.get(o.source) ?? 0) + 1);
  }
  const bySource = Array.from(bySourceMap.entries()).map(([source, count]) => ({
    source,
    count,
  }));

  return {
    totalSales,
    totalExpenses,
    netProfit: totalSales - totalExpenses,
    totalOrders: orders?.length ?? 0,
    totalPayments: payments?.length ?? 0,
    byDay,
    byPaymentMethod,
    byStatus,
    bySource,
  };
}

export async function getTopProducts(supabase: Client, range: DateRange, limit = 10) {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_name, quantity, subtotal, order:orders!inner(created_at, status)")
    .gte("order.created_at", range.from)
    .lte("order.created_at", range.to)
    .neq("order.status", "CANCELLED");
  if (error) throw error;

  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const row of data ?? []) {
    const entry = map.get(row.product_name) ?? {
      name: row.product_name,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += row.quantity;
    entry.revenue += Number(row.subtotal);
    map.set(row.product_name, entry);
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export async function getCashierPerformance(supabase: Client, range: DateRange) {
  const { data, error } = await supabase
    .from("payments")
    .select("amount, cashier:profiles(id, full_name)")
    .gte("created_at", range.from)
    .lte("created_at", range.to);
  if (error) throw error;

  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const row of data ?? []) {
    const cashier = row.cashier as { id: string; full_name: string } | null;
    if (!cashier) continue;
    const entry = map.get(cashier.id) ?? { name: cashier.full_name, total: 0, count: 0 };
    entry.total += Number(row.amount);
    entry.count += 1;
    map.set(cashier.id, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export async function getStaffActivityCounts(
  supabase: Client,
  range: DateRange,
  status: "SERVED" | "PREPARING" | "READY"
) {
  const { data, error } = await supabase
    .from("order_status_history")
    .select("changed_by, changed_at, user:profiles(id, full_name)")
    .eq("status", status)
    .gte("changed_at", range.from)
    .lte("changed_at", range.to);
  if (error) throw error;

  const map = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const user = row.user as { id: string; full_name: string } | null;
    if (!user) continue;
    const entry = map.get(user.id) ?? { name: user.full_name, count: 0 };
    entry.count += 1;
    map.set(user.id, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
