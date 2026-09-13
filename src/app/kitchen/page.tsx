import { createClient } from "@/lib/supabase/server";
import { getOrdersByStatuses } from "@/lib/services/orders";
import { KitchenBoard } from "./kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = await createClient();
  const orders = await getOrdersByStatuses(supabase, ["NEW", "PREPARING", "READY"]);

  return <KitchenBoard initialOrders={orders} />;
}
