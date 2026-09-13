"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createStaffOrder } from "@/lib/services/orders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea, Select, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, cn } from "@/lib/utils";
import { ALL_CATEGORY, buildMenuFilter } from "@/lib/menu-filter";
import type { Category, Product, Location } from "@/lib/types/domain";

interface CartLine {
  product: Product;
  quantity: number;
  note: string;
}

export function OrderBuilder({
  categories,
  locations,
  source,
  currency,
  onOrderCreated,
}: {
  categories: (Category & { products: Product[] })[];
  locations: Location[];
  source: "WAITER" | "CASHIER";
  currency: string;
  onOrderCreated?: (result: { order_id: string; order_number: number }) => void;
}) {
  // ALL by default: staff should see the whole menu without hunting through
  // pills first, which is most of a POS interaction.
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    [cart]
  );
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1, note: "" }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function updateNote(productId: string, value: string) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, note: value } : l)));
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  async function submit() {
    if (cart.length === 0) {
      toast.error("Add at least one item to the order");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const result = await createStaffOrder(supabase, {
        locationId: locationId || null,
        items: cart.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
          note: l.note || undefined,
        })),
        note,
        source,
      });
      toast.success(`Order #${result.order_number} created`);
      setCart([]);
      setNote("");
      setCartOpen(false);
      onOrderCreated?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  const menu = useMemo(
    () => buildMenuFilter(categories, activeCategory),
    [categories, activeCategory]
  );
  const activeProducts = menu.products;

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin">
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cart is empty</p>
        ) : (
          cart.map((line) => (
            <div key={line.product.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(line.product.price, currency)}
                  </p>
                </div>
                <button
                  onClick={() => removeLine(line.product.id)}
                  aria-label="Remove item"
                  className="-m-2 flex items-center justify-center p-2 text-muted-foreground hover:text-danger touch:min-h-11 touch:min-w-11"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(line.product.id, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted touch:h-11 touch:w-11"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                  <button
                    onClick={() => updateQty(line.product.id, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted touch:h-11 touch:w-11"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(line.product.price * line.quantity, currency)}
                </span>
              </div>
              <input
                type="text"
                placeholder="Item note (e.g. no onion)"
                value={line.note}
                onChange={(e) => updateNote(line.product.id, e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 touch:min-h-11 touch:text-sm"
              />
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        {locations.length > 0 && (
          <div>
            <Label htmlFor="location">Location (optional)</Label>
            <Select id="location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">No location / counter</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="order-note">Order note</Label>
          <Textarea
            id="order-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Special instructions..."
          />
        </div>
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
        <Button size="lg" className="w-full" loading={submitting} onClick={submit}>
          Place Order
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col lg:flex-row lg:gap-4">
      <div className="flex-1">
        <div
          role="tablist"
          aria-label="Menu categories"
          className="mb-3 flex gap-2 overflow-x-auto scrollbar-thin pb-1"
        >
          {[
            { id: ALL_CATEGORY, name: "ALL", count: menu.allCount },
            ...menu.categories.map((c) => ({
              id: c.id,
              name: c.name,
              count: c.products.length,
            })),
          ].map((pill) => (
            <button
              key={pill.id}
              role="tab"
              aria-selected={menu.activeId === pill.id}
              onClick={() => setActiveCategory(pill.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors touch:min-h-11 touch:px-5",
                menu.activeId === pill.id
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted/70"
              )}
            >
              {pill.name}
              <span className="ml-1.5 text-xs opacity-70">({pill.count})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {activeProducts.map((product) => (
            <Card
              key={product.id}
              className="flex cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md active:scale-[0.98]"
              onClick={() => addProduct(product)}
            >
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted text-3xl">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  "🍽️"
                )}
              </div>
              <div className="flex flex-1 flex-col justify-end p-2.5">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-sm font-semibold text-accent">
                  {formatCurrency(product.price, currency)}
                </p>
              </div>
            </Card>
          ))}
          {activeProducts.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {menu.categories.length === 0
                ? "No products are available right now."
                : "No products in this category"}
            </p>
          )}
        </div>
      </div>

      {/* Desktop cart panel */}
      <div className="hidden w-80 shrink-0 lg:block">
        <Card className="sticky top-4 flex h-[calc(100vh-6rem)] flex-col p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-4 w-4" /> Current Order
          </div>
          {cartPanel}
        </Card>
      </div>

      {/* Mobile floating cart button */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-30 flex items-center justify-between rounded-xl bg-brand-600 px-4 py-3 text-white shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2 font-medium">
            <ShoppingCart className="h-5 w-5" /> {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="font-bold">{formatCurrency(total, currency)}</span>
        </button>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Current Order" size="sm">
        {cartPanel}
      </Modal>
    </div>
  );
}
