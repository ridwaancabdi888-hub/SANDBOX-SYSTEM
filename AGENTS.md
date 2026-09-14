<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SANDBOX Cafeteria — working notes

See `README.md` for setup and architecture. These are the things that are easy
to get wrong here.

## Write path

Never write to `orders`, `order_items`, `payments`, `inventory_transactions`,
`notifications` or `activity_logs` directly from the client. Client roles only
hold `SELECT` on them. All mutations go through the `SECURITY DEFINER` functions
in `supabase/migrations/005_order_workflow_functions.sql`
(`place_qr_order`, `create_staff_order`, `advance_order_status`,
`record_payment`, `adjust_stock`). Add new business rules there, not in React.

For privileged work outside that set (creating staff accounts), use the
service-role client in an API route under `src/app/api/admin/` and gate it with
`requireRole(["admin"])`. `SUPABASE_SERVICE_ROLE_KEY` must never reach the
browser.

## Realtime

Call `supabase.realtime.setAuth(session.access_token)` **before** subscribing.
Skipping it means the socket authenticates as `anon`, RLS filters out every row,
and the subscription still reports `SUBSCRIBED` — a silent failure that looks
like "realtime is broken". See `src/lib/hooks/use-realtime-orders.ts`.

Anonymous customers have no RLS read path into `orders` by design, so the
tracking page polls `get_order_tracking(access_token)` rather than subscribing.

New tables that need live updates must be added to the `supabase_realtime`
publication.

## Server → Client boundary

Don't pass icon components (or any function) from a Server Component into a
Client Component — RSC can't serialize them. Nav definitions live in
`src/components/layout/nav-items.ts` and are imported by the client shell
directly. This already broke the dashboards once.

## Forms in modals

Modals seed state from props via `useState` initializers and are mounted with a
`key` by the parent (`{open && <Modal key={entity?.id ?? "new"} … />}`). Don't
reintroduce a `useEffect` that calls `setState` to sync props — the React
Compiler lint rules reject it and it reintroduces stale-form bugs.

## Branding

The cafeteria logo lives in the public `branding` Storage bucket; `settings.logo_url`
holds only the public URL. Never put image bytes in a DB column — that row is read
by the customer menu, the login page and every receipt.

Writes are gated by the bucket's RLS policies (`branding_admin_write`) using the
admin's **own** session, so no service-role key is involved. `settings` is
publicly readable by design, which is what lets the signed-out login page and the
QR menu show the logo.

Render it through `<BrandLogo>` — it falls back to the built-in "S" mark, so no
caller needs its own null handling. On receipts the logo is a `logo` block that
the ESC/POS renderer emits only when `supportsImages` is on **and** a bitmap was
produced (`raster.ts`, browser-only); otherwise the receipt prints as text.

## Sidebar navigation

Active state comes from `activeNavHref` (`nav-active.ts`), which picks the
**longest** matching href. Don't replace it with `pathname.startsWith(href)` —
every section index (`/admin`) prefixes its children, so that lights up two items
at once. It's covered by tests.

## Theming

Light and dark both come from CSS variables in `globals.css` — `:root` and
`.dark`. There is **one** theme system; don't add another.

- The `.dark` class is set by the blocking script in the root layout before
  first paint (`theme-script.tsx`). That is what prevents a white flash, and
  why `<html>` carries `suppressHydrationWarning` — the script deliberately
  changes what the server rendered.
- Theme is **device-local** (`use-theme.ts` / localStorage), like printer
  selection. It is not a cafeteria-wide setting.
- Style against tokens, never fixed palette shades. `bg-card`, `border-border`,
  `text-muted-foreground` adapt on their own; `bg-amber-50 text-amber-900` does
  not and will be unreadable in dark. For tinted states use the tone pairs:
  `bg-success-bg text-success`, and likewise `warning`, `danger`, `info`,
  `tone-brand`.
- Brand as a *fill* stays `bg-brand-600 text-white`. Brand as *text* on a card
  uses `text-accent`, which inverts for dark — `text-brand-700` on a dark card
  fails contrast.
- `bg-paper` / `text-paper-foreground` stay light in both themes on purpose:
  that is the receipt, which is printed on white paper.

## Language (i18n)

English and Somali, both LTR. English is the default for any device with no
preference, and product/category/ingredient names are **business data** — they
are never translated.

- **Locale is a cookie (`sandbox_lang`), not localStorage.** Theme can live in
  localStorage because it only toggles a CSS class that a pre-paint script
  fixes. Language changes rendered *text*, so the server has to know it at
  render time or every page hydrates against markup in the other language. The
  root layout reads it with `getLocale()` and seeds `<LocaleProvider>`, so
  server and client always agree. Do not "fix" this by moving it to
  localStorage.
- Server Components use `getT()` (`lib/i18n/server.ts`, `server-only`); client
  components use `useT()` from `@/lib/i18n`. Both return the same `t(key, vars)`.
- `en.ts` is the source of truth and `Dictionary = typeof en`. Every other
  locale is typed as `Dictionary`, so **a missing translation is a compile
  error**, not a runtime surprise. That is the missing-key guarantee; there is
  no need for a runtime scan.
- Interpolate, never concatenate: `t("orders.orderNumber", { number })`. Counts
  go through `plural("orders.itemCount", n)`, which picks `_one` / `_other`.
  Somali does not inflect a counted noun, so several of its pairs are
  identical on purpose.
- **Never translate a stored value.** `role`, `order_status`, `payment_method`
  and `ingredient_unit` are database enums and the contract with
  `advance_order_status` / `record_payment`. Translate the *label* through
  `roleKey()`, `orderStatusKey()`, `paymentMethodKey()`, `unitKey()`
  (`lib/i18n/labels.ts`), which map a stored value to a key. Tests assert every
  enum value has a label in both locales.
- Switching locale calls `router.refresh()`, not a reload, so an in-progress
  order or an open modal survives it.
- `states.tsx` stays hook-free and takes its strings as props — two Server
  Components render it, and a `useT()` call there would force a client
  boundary on them.
- Still English by design: ESC/POS adapter diagnostics, `require-role` throws
  and the LAN print API. They are developer/technical output, and
  `lib/printing/` must keep working outside React where there is no locale.
  Connection-type copy *is* translated via `labelKey`/`blurbKey`/`platformsKey`
  on `ConnectionTypeInfo`; the plain `label` stays English for queue entries
  and the sample receipt.

## Menu filtering

All three ordering surfaces (cashier, waiter, customer QR) share
`buildMenuFilter` (`src/lib/menu-filter.ts`) and default to the `ALL` pill.
One query loads categories-with-products; filtering is client-side, so tapping
a pill costs nothing. The helper drops empty categories, de-duplicates products
under ALL, and falls back to ALL for an unknown id. Covered by tests.

## Responsive & touch

Breakpoints follow Tailwind defaults; the sidebar is desktop-only (`lg:`) and a
drawer takes over below that.

- **`touch:`** is a custom variant for `(pointer: coarse)`. Use it to grow hit
  areas on phones and tablets — `touch:min-h-11` — instead of enlarging the
  control everywhere, which would loosen the desktop layout a mouse handles
  fine. 44px is the target.
- Every `<table>` lives inside an `overflow-x-auto` wrapper. `overflow-hidden`
  is not a substitute: it clips the columns instead of letting them scroll,
  which makes row actions unreachable.
- Where a table carries row actions, those stay reachable on a phone: the
  orders table renders cards below `sm`, and users/expenses/inventory pin the
  actions column with `sticky right-0`.
- Product cards are flex columns with the price/action block on `mt-auto`, so
  cards in a row end level whether or not an item has a description. Don't
  combine `mt-auto` with another `mt-*` — they fight over the same property.
- Images sit in an `aspect-[4/3]` box with `object-cover`, never `object-fill`.

`npm test` includes static guard rails for these (fixed pixel widths, table
wrappers, the touch variant, modal scroll structure).

## Printing

`src/lib/printing/` is a transport-agnostic gateway:
`PrinterService` -> `PrinterAdapter` -> printer, with a `PrintQueue` in front.
Cashier components talk **only** to `PrinterService` — never import an adapter,
build ESC/POS, or branch on connection type in UI code.

Facts that decide the design; don't re-litigate them:

- Web Bluetooth is **BLE GATT only**. It cannot reach Bluetooth Classic
  (SPP/RFCOMM) printers, which many portable receipt printers are. That's why
  the `rawbt` and `bridge` adapters exist.
- **No iOS browser implements Web Bluetooth.** iOS must use LAN or a bridge.
- **Browsers cannot open TCP sockets**, so LAN printing is relayed by
  `/api/print/lan` (server-side). That route is SSRF-guarded: private
  addresses and printer ports only. Don't loosen it.
- **Browsers cannot claim a USB printer interface** the OS driver owns —
  USB needs the bridge.
- Receipt text is a **single-byte code page** (`encoding.ts`), never UTF-8.
- There is **one canonical receipt document** (`receipt-model.ts`). Both the
  ESC/POS renderer and the HTML preview render from it through the same layout
  helpers. Never lay out a receipt anywhere else — that's how the preview and
  the paper drifted apart once already.
- Emit commands **only when the capability is enabled** (`supportsCut` etc.).
- Printer definitions are shared (DB); **which printer a device uses is
  device-local** (`usePrinter` / localStorage).
- Adapters probe browser-only APIs, so never construct them during SSR — gate
  on `useIsClient()` or you get a hydration mismatch.
- Don't use TypeScript **parameter properties** (`constructor(private x)`) in
  this module: tests run under Node's type-stripping, which rejects them.

Changing any of it? Run `npm test` — 110 tests cover encoding, layout, capability
gating, logo raster gating, the queue (ordering, dedupe, retry, failure), every
adapter against mock printers, the menu ALL filter, the responsive guards and
the locale dictionaries.

## Checks before calling something done

```bash
npx tsc --noEmit && npx eslint . && npm test && npm run build
```

`next build` does not run ESLint, so run it separately.
