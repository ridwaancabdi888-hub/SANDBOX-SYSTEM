import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
type IngredientInsert = Database["public"]["Tables"]["ingredients"]["Insert"];
type IngredientUpdate = Database["public"]["Tables"]["ingredients"]["Update"];

export async function getIngredients(supabase: Client) {
  const { data, error } = await supabase.from("ingredients").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getLowStockIngredients(supabase: Client) {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).filter((i) => i.current_quantity <= i.minimum_quantity);
}

export async function createIngredient(supabase: Client, payload: IngredientInsert) {
  const { data, error } = await supabase.from("ingredients").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateIngredient(supabase: Client, id: string, payload: IngredientUpdate) {
  const { data, error } = await supabase
    .from("ingredients")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function adjustStock(
  supabase: Client,
  params: {
    ingredientId: string;
    quantityDelta: number;
    type: Database["public"]["Enums"]["stock_txn_type"];
    reason: string;
  }
) {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_ingredient_id: params.ingredientId,
    p_quantity_delta: params.quantityDelta,
    p_type: params.type,
    p_reason: params.reason,
  });
  if (error) throw error;
  return data;
}

export async function getStockHistory(supabase: Client, ingredientId?: string, limit = 100) {
  let query = supabase
    .from("inventory_transactions")
    .select("*, ingredient:ingredients(id,name,unit), user:profiles(id,full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (ingredientId) query = query.eq("ingredient_id", ingredientId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
