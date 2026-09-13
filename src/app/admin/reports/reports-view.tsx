"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getSalesReport,
  getTopProducts,
  getCashierPerformance,
  getStaffActivityCounts,
  type DateRange,
} from "@/lib/services/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { downloadCsv } from "@/lib/utils/csv";
import { formatCurrency } from "@/lib/utils";

type Report = Awaited<ReturnType<typeof getSalesReport>>;
type TopProducts = Awaited<ReturnType<typeof getTopProducts>>;
type StaffPerf = Awaited<ReturnType<typeof getCashierPerformance>>;
type ActivityCounts = Awaited<ReturnType<typeof getStaffActivityCounts>>;

function presetRange(preset: string): DateRange {
  const now = new Date();
  const start = new Date();
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else if (preset === "week") start.setDate(start.getDate() - 7);
  else if (preset === "month") start.setDate(start.getDate() - 30);
  return { from: start.toISOString(), to: now.toISOString() };
}

export function ReportsView({
  initialReport,
  initialTopProducts,
  initialCashierPerf,
  initialWaiterActivity,
  initialKitchenActivity,
  currency,
}: {
  initialReport: Report;
  initialTopProducts: TopProducts;
  initialCashierPerf: StaffPerf;
  initialWaiterActivity: ActivityCounts;
  initialKitchenActivity: ActivityCounts;
  currency: string;
}) {
  const [preset, setPreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(initialReport);
  const [topProducts, setTopProducts] = useState(initialTopProducts);
  const [cashierPerf, setCashierPerf] = useState(initialCashierPerf);
  const [waiterActivity, setWaiterActivity] = useState(initialWaiterActivity);
  const [kitchenActivity, setKitchenActivity] = useState(initialKitchenActivity);

  async function loadRange(range: DateRange) {
    setLoading(true);
    try {
      const supabase = createClient();
      const [r, tp, cp, wa, ka] = await Promise.all([
        getSalesReport(supabase, range),
        getTopProducts(supabase, range, 10),
        getCashierPerformance(supabase, range),
        getStaffActivityCounts(supabase, range, "SERVED"),
        getStaffActivityCounts(supabase, range, "READY"),
      ]);
      setReport(r);
      setTopProducts(tp);
      setCashierPerf(cp);
      setWaiterActivity(wa);
      setKitchenActivity(ka);
    } finally {
      setLoading(false);
    }
  }

  function handlePreset(value: string) {
    setPreset(value);
    if (value !== "custom") loadRange(presetRange(value));
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    loadRange({ from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() });
  }

  function exportSalesCsv() {
    downloadCsv(
      `sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
      report.byDay.map((d) => ({ date: d.date, total: d.total }))
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-auto" value={preset} onChange={(e) => handlePreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" className="w-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input type="date" className="w-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              <Button size="sm" onClick={applyCustom} loading={loading}>
                Apply
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportSalesCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Sales" value={formatCurrency(report.totalSales, currency)} />
        <SummaryCard label="Expenses" value={formatCurrency(report.totalExpenses, currency)} />
        <SummaryCard label="Net Profit" value={formatCurrency(report.netProfit, currency)} />
        <SummaryCard label="Orders" value={String(report.totalOrders)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best-Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.name} className="border-t border-border first:border-0">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{p.quantity} sold</td>
                      <td className="py-1.5 text-right font-medium">
                        {formatCurrency(p.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cashier Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {cashierPerf.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments in this period</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {cashierPerf.map((c) => (
                    <tr key={c.name} className="border-t border-border first:border-0">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{c.count} orders</td>
                      <td className="py-1.5 text-right font-medium">
                        {formatCurrency(c.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Waiter Activity (orders served)</CardTitle>
          </CardHeader>
          <CardContent>
            {waiterActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {waiterActivity.map((w) => (
                    <tr key={w.name} className="border-t border-border first:border-0">
                      <td className="py-1.5">{w.name}</td>
                      <td className="py-1.5 text-right font-medium">{w.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kitchen Activity (orders marked ready)</CardTitle>
          </CardHeader>
          <CardContent>
            {kitchenActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {kitchenActivity.map((k) => (
                    <tr key={k.name} className="border-t border-border first:border-0">
                      <td className="py-1.5">{k.name}</td>
                      <td className="py-1.5 text-right font-medium">{k.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </Card>
  );
}
