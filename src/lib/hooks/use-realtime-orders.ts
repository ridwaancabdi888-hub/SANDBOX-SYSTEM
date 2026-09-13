"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getOrderById } from "@/lib/services/orders";
import type { OrderWithItems, OrderStatus } from "@/lib/types/domain";

/**
 * Keeps a live list of orders in sync via Supabase Realtime.
 * `filterStatuses` controls which statuses stay in the returned list —
 * orders that transition out of the watched set are removed automatically,
 * which is how e.g. the kitchen board drops an order once it's SERVED.
 */
export function useRealtimeOrders(
  initialOrders: OrderWithItems[],
  filterStatuses: OrderStatus[] | null,
  onEvent?: (event: { type: "new" | "update"; order: OrderWithItems }) => void
) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);
  const onEventRef = useRef(onEvent);
  const filterRef = useRef(filterStatuses);

  useEffect(() => {
    onEventRef.current = onEvent;
    filterRef.current = filterStatuses;
  });

  // Re-seed from the server payload when the caller swaps in a different set
  // of orders (e.g. the orders table re-runs a filtered query).
  const initialIds = initialOrders.map((o) => o.id).join(",");
  const [seededIds, setSeededIds] = useState(initialIds);
  if (initialIds !== seededIds) {
    setSeededIds(initialIds);
    setOrders(initialOrders);
  }

  const upsertOrder = useCallback((order: OrderWithItems) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === order.id);
      const inFilter = !filterRef.current || filterRef.current.includes(order.status);

      if (!inFilter) {
        return prev.filter((o) => o.id !== order.id);
      }
      if (exists) {
        return prev.map((o) => (o.id === order.id ? { ...o, ...order, items: o.items } : o));
      }
      return [...prev, order];
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const handleChange = async (id: string, type: "new" | "update") => {
      try {
        const full = await getOrderById(supabase, id);
        upsertOrder(full);
        onEventRef.current?.({ type, order: full });
      } catch {
        // order may have become inaccessible; ignore
      }
    };

    void (async () => {
      // Realtime must be told the signed-in user's access token. Without it
      // the socket authenticates with the anon key only, RLS is evaluated as
      // `anon`, and every row is silently filtered out — the subscription
      // succeeds but no events are ever delivered.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(session?.access_token ?? null);
      if (cancelled) return;

      channel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => handleChange(payload.new.id as string, "new")
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => handleChange(payload.new.id as string, "update")
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [upsertOrder]);

  return orders;
}
