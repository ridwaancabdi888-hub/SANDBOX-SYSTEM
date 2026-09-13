/**
 * The href of the nav item the current URL belongs to, or null.
 *
 * Picks the **longest** matching href rather than the first, because every
 * section's index (`/admin`) is a prefix of all of its children. A naive
 * `startsWith` lights up both "Dashboard" and "Orders" on `/admin/orders`.
 * Prefixes only match at a segment boundary, so `/admin/orders` never
 * activates a hypothetical `/admin/order`, and nested routes such as
 * `/admin/menu/123/edit` still resolve to "Menu".
 *
 * Kept apart from `nav-items.ts` so it stays free of the icon imports and can
 * be unit-tested on its own.
 */
export function activeNavHref(pathname: string, items: { href: string }[]): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: string | null = null;

  for (const { href } of items) {
    const base = href.length > 1 ? href.replace(/\/+$/, "") : href;
    if (path === base || path.startsWith(base === "/" ? "/" : base + "/")) {
      if (best === null || base.length > best.length) best = href;
    }
  }
  return best;
}
