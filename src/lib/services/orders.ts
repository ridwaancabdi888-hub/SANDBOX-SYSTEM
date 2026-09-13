import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import type { OrderStatus, OrderWithItems } from "@/lib/types/domain";

type Client = SupabaseClient<Database>;

const ORDER_SELECT = "*, items:order_items(*), location:locations(id,name,code)";

export async function getOrderById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as OrderWithItems;
}

export async function getOrdersByStatuses(
  supabase: Client,
  statuses: OrderStatus[],
  opts: { ascending?: boolean; limit?: number } = {}
) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", statuses)
    .order("created_at", { ascending: opts.ascending ?? true })
    .limit(opts.limit ?? 200);
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

export interface OrderFilters {
  search?: string;
  statuses?: OrderStatus[];
  source?: Database["public"]["Enums"]["order_source"];
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  unpaidOnly?: boolean;
  limit?: number;
}

export async function searchOrders(supabase: Client, filters: OrderFilters) {
  let query = supabase.from("orders").select(ORDER_SELECT);

  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.search) {
    const num = Number(filters.search);
    if (!Number.isNaN(num)) {
      query = query.eq("order_number", num);
    }
  }

  query = query.order("created_at", { ascending: false }).limit(filters.limit ?? 100);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OrderWithItems[];
}

export async function placeQrOrder(
  supabase: Client,
  params: { locationCode: string; items: { product_id: string; quantity: number; note?: string }[]; note?: string }
) {
  const { data, error } = await supabase.rpc("place_qr_order", {
    p_location_code: params.locationCode,
    p_items: params.items,
    p_note: params.note ?? "",
  });
  if (error) throw error;
  return data?.[0] as { order_id: string; order_number: number; access_token: string };
}

export async function createStaffOrder(
  supabase: Client,
  params: {
    locationId?: string | null;
    items: { product_id: string; quantity: number; note?: string }[];
    note?: string;
    source: "WAITER" | "CASHIER" | "ADMIN";
  }
) {
  const { data, error } = await supabase.rpc("create_staff_order", {
    p_location_id: params.locationId ?? null,
    p_items: params.items,
    p_note: params.note ?? "",
    p_source: params.source,
  });
  if (error) throw error;
  return data?.[0] as { order_id: string; order_number: number; access_token: string };
}

export async function advanceOrderStatus(
  supabase: Client,
  orderId: string,
  newStatus: OrderStatus,
  note?: string
) {
  const { data, error } = await supabase.rpc("advance_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function recordPayment(
  supabase: Client,
  params: { orderId: string; method: Database["public"]["Enums"]["payment_method"]; amountPaid: number }
) {
  const { data, error } = await supabase.rpc("record_payment", {
    p_order_id: params.orderId,
    p_method: params.method,
    p_amount_paid: params.amountPaid,
  });
  if (error) throw error;
  return data?.[0] as { payment_id: string; change_amount: number };
}

export async function getOrderTracking(supabase: Client, accessToken: string) {
  const { data, error } = await supabase.rpc("get_order_tracking", {
    p_access_token: accessToken,
  });
  if (error) throw error;
  return data as {
    id: string;
    order_number: number;
    status: OrderStatus;
    source: string;
    customer_note: string | null;
    subtotal: number;
    discount: number;
    total: number;
    created_at: string;
    location_name: string | null;
    location_code: string | null;
    items: { id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; note: string | null }[];
    history: { status: OrderStatus; changed_at: string }[];
  };
}
