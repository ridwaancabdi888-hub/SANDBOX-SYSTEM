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
import { ALL_CATEGORY, buildMenuFilter } from "@/lib/menu-filter";
import { useT, usePlural } from "@/lib/i18n";
import { CustomerLanguageToggle } from "@/components/layout/language-toggle";
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
  // ALL by default: a customer who just scanned a QR code should see the
  // menu, not one arbitrary category.
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useT();
  const plural = usePlural();
  const { items, orderNote, addItem, incrementItem, decrementItem, updateItemNote, setOrderNote, clear } =
    useCartStore();

  const total = useMemo(() => cartTotal(items), [items]);
  const count = useMemo(() => cartCount(items), [items]);
  const menu = useMemo(
    () => buildMenuFilter(categories, activeCategory),
    [categories, activeCategory]
  );
  const activeProducts = menu.products;

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
      toast.error(err instanceof Error ? err.message : t("customer.orderFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BrandLogo logoUrl={logoUrl} name={cafeteriaName} size="md" rounded="rounded-xl" />
              <div className="min-w-0">
                <div className="truncate text-sm font-bold leading-tight">{cafeteriaName}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{locationName}</span>
                </div>
              </div>
            </div>
            {/* Shares the brand row rather than claiming its own: on a 320px
                phone a dedicated language bar costs a product row. */}
            <CustomerLanguageToggle className="shrink-0" />
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t("menu.categories")}
          className="mx-auto flex max-w-2xl gap-2 overflow-x-auto scrollbar-thin px-4 pb-3"
        >
          {[{ id: ALL_CATEGORY, name: t("common.all") }, ...menu.categories].map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={menu.activeId === cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors touch:min-h-11 touch:px-5",
                menu.activeId === cat.id
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
        {menu.categories.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("customer.noItems")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {activeProducts.map((product) => {
              const inCart = items.find((i) => i.productId === product.id);
              return (
                <div
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted text-3xl">
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
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    {product.description && (
                      <p className="truncate text-xs text-muted-foreground">{product.description}</p>
                    )}
                    {/* Price above the action, not beside it: at 320px a card
                        is ~118px of content, which cannot hold a price and a
                        thumb-sized stepper on one line. */}
                    <div className="mt-auto space-y-2 pt-2">
                      <span className="block text-sm font-bold text-accent">
                        {formatCurrency(product.price, currency)}
                      </span>
                      {inCart ? (
                        <div className="flex items-center justify-between gap-1 rounded-full bg-muted p-1">
                          <button
                            onClick={() => decrementItem(product.id)}
                            aria-label={t("newOrder.removeOne", { name: product.name })}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm touch:h-10 touch:w-10"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-semibold tabular-nums">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => incrementItem(product.id)}
                            aria-label={t("newOrder.addOne", { name: product.name })}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white touch:h-10 touch:w-10"
                          >
                            <Plus className="h-4 w-4" />
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
                          aria-label={t("customer.addToOrder", { name: product.name })}
                          className="w-full rounded-full bg-brand-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-brand-700 touch:min-h-11 touch:text-sm"
                        >
                          {t("customer.add")}
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
            <ShoppingCart className="h-5 w-5" /> {plural("customer.itemCount", count)}
          </span>
          <span className="font-bold">{formatCurrency(total, currency)}</span>
        </button>
      )}

      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={t("customer.yourOrder")} size="sm">
        <div className="space-y-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {locationName}
          </div>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("customer.cartEmpty")}</p>
          ) : (
            <div className="max-h-[40vh] space-y-2 overflow-y-auto scrollbar-thin sm:max-h-80">
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
                      aria-label={t("newOrder.removeOne", { name: item.name })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted touch:h-11 touch:w-11"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => incrementItem(item.productId)}
                      aria-label={t("newOrder.addOne", { name: item.name })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white touch:h-11 touch:w-11"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t("customer.itemNotePlaceholder")}
                    value={item.note ?? ""}
                    onChange={(e) => updateItemNote(item.productId, e.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 touch:min-h-11 touch:text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <Textarea
              rows={2}
              placeholder={t("customer.orderNotePlaceholder")}
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-lg font-bold">
            <span>{t("common.total")}</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={items.length === 0}
            loading={submitting}
            onClick={submitOrder}
          >
            {t("customer.placeOrder")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
