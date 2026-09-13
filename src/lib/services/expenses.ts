import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];

export async function getExpenses(supabase: Client, dateFrom?: string, dateTo?: string) {
  let query = supabase
    .from("expenses")
    .select("*, created_by_profile:profiles(id, full_name)")
    .order("expense_date", { ascending: false });
  if (dateFrom) query = query.gte("expense_date", dateFrom);
  if (dateTo) query = query.lte("expense_date", dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createExpense(supabase: Client, payload: ExpenseInsert) {
  const { data, error } = await supabase.from("expenses").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(supabase: Client, id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "Transport",
  "Supplies",
  "Maintenance",
  "Rent",
  "Salaries",
  "Other",
];
