import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

export async function getSettings(supabase: Client) {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateSettings(
  supabase: Client,
  payload: Database["public"]["Tables"]["settings"]["Update"]
) {
  const { data, error } = await supabase
    .from("settings")
    .update(payload)
    .eq("id", 1)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPrinterSettings(supabase: Client) {
  const { data, error } = await supabase
    .from("printer_settings")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createPrinterSetting(
  supabase: Client,
  payload: Database["public"]["Tables"]["printer_settings"]["Insert"]
) {
  const { data, error } = await supabase
    .from("printer_settings")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePrinterSetting(
  supabase: Client,
  id: string,
  payload: Database["public"]["Tables"]["printer_settings"]["Update"]
) {
  const { data, error } = await supabase
    .from("printer_settings")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePrinterSetting(supabase: Client, id: string) {
  const { error } = await supabase.from("printer_settings").delete().eq("id", id);
  if (error) throw error;
}
