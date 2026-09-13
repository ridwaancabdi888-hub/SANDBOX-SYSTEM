import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import type { PaymentMethod } from "@/lib/types/domain";

type Client = SupabaseClient<Database>;

export interface PaymentForReceipt {
  method: PaymentMethod;
  amount_paid: number;
  change_amount: number;
  created_at: string;
  cashier_name: string | null;
}

/** Loads the payment behind an order so its receipt can be reprinted. */
export async function getPaymentByOrderId(
  supabase: Client,
  orderId: string
): Promise<PaymentForReceipt | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("method, amount_paid, change_amount, created_at, cashier:profiles(full_name)")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const cashier = data.cashier as { full_name: string } | null;
  return {
    method: data.method as PaymentMethod,
    amount_paid: Number(data.amount_paid),
    change_amount: Number(data.change_amount),
    created_at: data.created_at,
    cashier_name: cashier?.full_name ?? null,
  };
}
