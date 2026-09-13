import { createClient } from "@/lib/supabase/server";
import { getOrdersByStatuses } from "@/lib/services/orders";
import { WaiterBoard } from "./waiter-board";

export const dynamic = "force-dynamic";

export default async function WaiterPage() {
  const supabase = await createClient();
  const orders = await getOrdersByStatuses(supabase, ["NEW", "PREPARING", "READY", "SERVED"], {
    ascending: false,
    limit: 100,
  });

  return <WaiterBoard initialOrders={orders} />;
}
