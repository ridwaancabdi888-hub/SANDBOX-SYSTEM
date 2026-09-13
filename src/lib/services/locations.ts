import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
type LocationInsert = Database["public"]["Tables"]["locations"]["Insert"];
type LocationUpdate = Database["public"]["Tables"]["locations"]["Update"];

export async function getLocations(supabase: Client) {
  const { data, error } = await supabase.from("locations").select("*").order("code");
  if (error) throw error;
  return data;
}

export async function getActiveLocations(supabase: Client) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("active", true)
    .order("code");
  if (error) throw error;
  return data;
}

export async function createLocation(supabase: Client, payload: LocationInsert) {
  const { data, error } = await supabase.from("locations").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateLocation(supabase: Client, id: string, payload: LocationUpdate) {
  const { data, error } = await supabase
    .from("locations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLocation(supabase: Client, id: string) {
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) throw error;
}

export function getMenuUrl(appUrl: string, locationCode: string) {
  return `${appUrl}/menu/${locationCode}`;
}
