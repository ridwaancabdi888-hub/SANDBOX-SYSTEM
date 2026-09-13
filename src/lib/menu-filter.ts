import type { Category, Product } from "@/lib/types/domain";

export type CategoryWithProducts = Category & { products: Product[] };

/** Sentinel for the "show everything" pill. Not a real category id. */
export const ALL_CATEGORY = "ALL";

/**
 * Category pills plus the products to show, from one already-loaded list.
 *
 * Every ordering surface (cashier, waiter, customer QR) filters the same
 * categories-with-products payload client-side — no extra query per category,
 * and no second round trip when someone taps a pill.
 *
 * Categories with nothing available are dropped: an empty pill is a dead end,
 * and on the customer menu it would advertise a section that has nothing in it.
 */
export function buildMenuFilter(
  categories: CategoryWithProducts[],
  activeCategory: string
) {
  const withProducts = categories.filter((c) => c.products.length > 0);

  // De-duplicated because a product could in principle appear under more than
  // one category row; the same item must never show twice under ALL.
  const seen = new Set<string>();
  const allProducts: Product[] = [];
  for (const category of withProducts) {
    for (const product of category.products) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      allProducts.push(product);
    }
  }

  const isAll = activeCategory === ALL_CATEGORY;
  const matched = withProducts.find((c) => c.id === activeCategory);

  return {
    categories: withProducts,
    allCount: allProducts.length,
    // An unknown id (category deactivated while the page was open) falls back
    // to ALL rather than rendering an empty grid.
    products: isAll || !matched ? allProducts : matched.products,
    activeId: isAll || !matched ? ALL_CATEGORY : matched.id,
  };
}
