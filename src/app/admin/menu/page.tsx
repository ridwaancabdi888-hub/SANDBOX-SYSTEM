import { createClient } from "@/lib/supabase/server";
import { getCategories, getProducts } from "@/lib/services/menu";
import { getIngredients } from "@/lib/services/inventory";
import { getSettings } from "@/lib/services/settings";
import { MenuManager } from "./menu-manager";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const [categories, products, ingredients, settings] = await Promise.all([
    getCategories(supabase),
    getProducts(supabase),
    getIngredients(supabase),
    getSettings(supabase),
  ]);

  return (
    <MenuManager
      initialCategories={categories}
      initialProducts={products}
      ingredients={ingredients}
      currency={settings.currency}
    />
  );
}
