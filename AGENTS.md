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

Changing any of it? Run `npm test` — 65 tests cover encoding, layout, capability
gating, logo raster gating, the queue (ordering, dedupe, retry, failure) and
every adapter against mock printers.

## Checks before calling something done

```bash
npx tsc --noEmit && npx eslint . && npm test && npm run build
```

`next build` does not run ESLint, so run it separately.
