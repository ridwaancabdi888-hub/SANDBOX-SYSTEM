import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import {
  DEFAULT_CAPABILITIES,
  type CodePage,
  type ConnectionType,
  type PrinterCapabilities,
  type PrinterConnectionParams,
  type PrinterProfile,
  type PrinterRole,
  type ReceiptWidth,
} from "@/lib/printing";

type Client = SupabaseClient<Database>;

/** Shape of a printer_settings row after migration 012. */
interface PrinterRow {
  id: string;
  name: string;
  width_mm: number;
  is_default: boolean;
  config: unknown;
  connection_type: string;
  role: string;
  active: boolean;
  encoding: string;
  feed_lines: number;
  copies: number;
  auto_reconnect: boolean;
  capabilities: unknown;
}

export function rowToProfile(row: PrinterRow): PrinterProfile {
  return {
    id: row.id,
    name: row.name,
    role: row.role as PrinterRole,
    connectionType: row.connection_type as ConnectionType,
    paperWidth: (row.width_mm === 58 ? 58 : 80) as ReceiptWidth,
    encoding: (row.encoding as CodePage) ?? "CP437",
    capabilities: { ...DEFAULT_CAPABILITIES, ...(row.capabilities as Partial<PrinterCapabilities>) },
    connection: (row.config ?? {}) as PrinterConnectionParams,
    feedLines: row.feed_lines ?? 4,
    copies: row.copies ?? 1,
    autoReconnect: row.auto_reconnect ?? true,
    isDefault: row.is_default,
    active: row.active,
  };
}

function profileToRow(profile: Partial<PrinterProfile>) {
  const row: Record<string, unknown> = {};
  if (profile.name !== undefined) row.name = profile.name;
  if (profile.role !== undefined) row.role = profile.role;
  if (profile.connectionType !== undefined) row.connection_type = profile.connectionType;
  if (profile.paperWidth !== undefined) row.width_mm = profile.paperWidth;
  if (profile.encoding !== undefined) row.encoding = profile.encoding;
  if (profile.capabilities !== undefined) row.capabilities = profile.capabilities;
  if (profile.connection !== undefined) row.config = profile.connection;
  if (profile.feedLines !== undefined) row.feed_lines = profile.feedLines;
  if (profile.copies !== undefined) row.copies = profile.copies;
  if (profile.autoReconnect !== undefined) row.auto_reconnect = profile.autoReconnect;
  if (profile.isDefault !== undefined) row.is_default = profile.isDefault;
  if (profile.active !== undefined) row.active = profile.active;
  return row;
}

export async function getPrinterProfiles(supabase: Client): Promise<PrinterProfile[]> {
  const { data, error } = await supabase
    .from("printer_settings")
    .select("*")
    .order("role")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => rowToProfile(row as unknown as PrinterRow));
}

export async function createPrinterProfile(
  supabase: Client,
  profile: Partial<PrinterProfile>
): Promise<PrinterProfile> {
  const { data, error } = await supabase
    .from("printer_settings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(profileToRow(profile) as any)
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as unknown as PrinterRow);
}

export async function updatePrinterProfile(
  supabase: Client,
  id: string,
  patch: Partial<PrinterProfile>
): Promise<PrinterProfile> {
  const { data, error } = await supabase
    .from("printer_settings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(profileToRow(patch) as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as unknown as PrinterRow);
}

export async function deletePrinterProfile(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("printer_settings").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Only one printer per role may be the default, enforced by a partial unique
 * index, so the previous default is cleared first.
 */
export async function setDefaultPrinter(
  supabase: Client,
  id: string,
  role: PrinterRole
): Promise<void> {
  const { error: clearError } = await supabase
    .from("printer_settings")
    .update({ is_default: false })
    .eq("role", role)
    .neq("id", id);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from("printer_settings")
    .update({ is_default: true })
    .eq("id", id);
  if (error) throw error;
}
