import { createClient } from "@/lib/supabase/server";
import { getIngredients, getStockHistory } from "@/lib/services/inventory";
import { InventoryManager } from "./inventory-manager";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const supabase = await createClient();
  const [ingredients, history] = await Promise.all([
    getIngredients(supabase),
    getStockHistory(supabase, undefined, 100),
  ]);

  return <InventoryManager initialIngredients={ingredients} initialHistory={history} />;
}
