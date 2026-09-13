import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];

export async function getCategories(supabase: Client) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getProducts(supabase: Client) {
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAvailableProductsByCategory(supabase: Client) {
  const { data, error } = await supabase
    .from("categories")
    .select("*, products(*)")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((cat) => ({
    ...cat,
    products: (cat.products ?? []).filter((p) => p.available),
  }));
}

export async function createCategory(supabase: Client, payload: CategoryInsert) {
  const { data, error } = await supabase.from("categories").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  supabase: Client,
  id: string,
  payload: Database["public"]["Tables"]["categories"]["Update"]
) {
  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(supabase: Client, id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function createProduct(supabase: Client, payload: ProductInsert) {
  const { data, error } = await supabase.from("products").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(supabase: Client, id: string, payload: ProductUpdate) {
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(supabase: Client, id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function getProductRecipe(supabase: Client, productId: string) {
  const { data, error } = await supabase
    .from("product_ingredients")
    .select("*, ingredient:ingredients(id, name, unit)")
    .eq("product_id", productId);
  if (error) throw error;
  return data;
}

export async function setProductRecipe(
  supabase: Client,
  productId: string,
  items: { ingredient_id: string; quantity: number }[]
) {
  const { error: delError } = await supabase
    .from("product_ingredients")
    .delete()
    .eq("product_id", productId);
  if (delError) throw delError;

  if (items.length === 0) return;

  const { error } = await supabase
    .from("product_ingredients")
    .insert(items.map((i) => ({ product_id: productId, ...i })));
  if (error) throw error;
}

export async function uploadProductImage(supabase: Client, file: File) {
  const ext = file.name.split(".").pop();
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
