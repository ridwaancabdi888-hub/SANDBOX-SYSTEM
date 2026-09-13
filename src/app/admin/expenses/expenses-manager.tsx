"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Download, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createExpense, deleteExpense, EXPENSE_CATEGORIES } from "@/lib/services/expenses";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { downloadCsv } from "@/lib/utils/csv";
import { formatCurrency } from "@/lib/utils";

interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
  created_at: string;
  created_by_profile: { full_name: string } | null;
}

export function ExpensesManager({
  initialExpenses,
  currency,
}: {
  initialExpenses: ExpenseRow[];
  currency: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const total = initialExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  function refresh() {
    router.refresh();
  }

  async function submit() {
    if (!title.trim() || !amount) {
      toast.error("Title and amount are required");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      await createExpense(supabase, {
        title: title.trim(),
        amount: Number(amount),
        category,
        description: description.trim() || null,
        expense_date: date,
      });
      toast.success("Expense recorded");
      setTitle("");
      setAmount("");
      setDescription("");
      setModalOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record expense");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(expense: ExpenseRow) {
    const ok = await confirm({
      title: `Delete "${expense.title}"?`,
      variant: "danger",
    });
    if (!ok) return;
    const supabase = createClient();
    await deleteExpense(supabase, expense.id);
    toast.success("Expense deleted");
    refresh();
  }

  function exportCsv() {
    downloadCsv(
      `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      initialExpenses.map((e) => ({
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        date: e.expense_date,
        created_by: e.created_by_profile?.full_name ?? "",
      }))
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={initialExpenses.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Expense
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {initialExpenses.length} expenses · Total {formatCurrency(total, currency)}
      </p>

      {initialExpenses.length === 0 ? (
        <EmptyState icon={<Receipt className="h-6 w-6" />} title="No expenses recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialExpenses.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{e.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.category}</td>
                  <td className="px-3 py-2">{formatCurrency(Number(e.amount), currency)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.expense_date}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.created_by_profile?.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(e)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Expense" size="sm">
        <div className="space-y-3">
          <div>
            <Label htmlFor="ex-title">Title</Label>
            <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ex-amount">Amount</Label>
              <Input
                id="ex-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ex-category">Category</Label>
              <Select id="ex-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ex-date">Date</Label>
            <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ex-desc">Description</Label>
            <Textarea id="ex-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={submit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
