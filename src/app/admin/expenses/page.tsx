import { createClient } from "@/lib/supabase/server";
import { getExpenses } from "@/lib/services/expenses";
import { getSettings } from "@/lib/services/settings";
import { ExpensesManager } from "./expenses-manager";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage() {
  const supabase = await createClient();
  const [expenses, settings] = await Promise.all([getExpenses(supabase), getSettings(supabase)]);

  return <ExpensesManager initialExpenses={expenses} currency={settings.currency} />;
}
