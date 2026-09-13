"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { placeQrOrder } from "@/lib/services/orders";
import { useCartStore, cartTotal, cartCount } from "@/lib/stores/cart-store";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import type { Category, Product } from "@/lib/types/domain";

export function CustomerMenu({
  locationCode,
  locationName,
  cafeteriaName,
  logoUrl,
  currency,
  categories,
}: {
  locationCode: string;
  locationName: string;
  cafeteriaName: string;
  logoUrl?: string | null;
  currency: string;
  categories: (Category & { products: Product[] })[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { items, orderNote, addItem, incrementItem, decrementItem, updateItemNote, setOrderNote, clear } =
    useCartStore();

  const total = useMemo(() => cartTotal(items), [items]);
  const count = useMemo(() => cartCount(items), [items]);
  const activeProducts = categories.find((c) => c.id === activeCategory)?.products ?? [];

  async function submitOrder() {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const result = await placeQrOrder(supabase, {
        locationCode,
        items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, note: i.note })),
        note: orderNote,
      });
      clear();
      router.push(`/order/${result.access_token}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <BrandLogo logoUrl={logoUrl} name={cafeteriaName} size="md" rounded="rounded-xl" />
            <div>
              <div className="text-sm font-bold leading-tight">{cafeteriaName}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {locationName}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl gap-2 overflow-x-auto scrollbar-thin px-4 pb-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                activeCategory === cat.id
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-foreground hover:bg-muted/70"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No items are available right now. Please check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {activeProducts.map((product) => {
              const inCart = items.find((i) => i.productId === product.id);
              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex h-24 items-center justify-center bg-muted text-3xl">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "🍽️"
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    {product.description && (
                      <p className="truncate text-xs text-muted-foreground">{product.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-brand-700">
                        {formatCurrency(product.price, currency)}
                      </span>
                      {inCart ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => decrementItem(product.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-4 text-center text-xs font-semibold">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => incrementItem(product.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            addItem({
                              productId: product.id,
                              name: product.name,
                              price: product.price,
                              imageUrl: product.image_url,
                            })
                          }
                          className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-30 mx-auto flex max-w-2xl items-center justify-between rounded-xl bg-brand-600 px-4 py-3.5 text-white shadow-xl"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart className="h-5 w-5" /> {count} item{count === 1 ? "" : "s"}
          </span>
          <span className="font-bold">{formatCurrency(total, currency)}</span>
        </button>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Your Order" size="sm">
        <div className="space-y-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {locationName}
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Your cart is empty</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto scrollbar-thin">
              {items.map((item) => (
                <div key={item.productId} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.price * item.quantity, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      onClick={() => decrementItem(item.productId)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center text-xs font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => incrementItem(item.productId)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. no onion"
                    value={item.note ?? ""}
                    onChange={(e) => updateItemNote(item.productId, e.target.value)}
                    className="mt-2 w-full rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <Textarea
              rows={2}
              placeholder="Order note (e.g. less sugar, extra spicy)"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={items.length === 0}
            loading={submitting}
            onClick={submitOrder}
          >
            Place Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
