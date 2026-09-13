# SANDBOX Cafeteria Management System

A production-oriented cafeteria POS built with Next.js (App Router) + Supabase.
It covers QR seat ordering, a kitchen display, a waiter hand-off flow, a cashier
POS with thermal receipt printing, ingredient-level inventory, and an admin
back office — all wired together with Supabase Realtime.

```
CUSTOMER QR → MENU → ORDER ──┬──→ KITCHEN → WAITER → SERVED
                             └──→ CASHIER → PAYMENT → RECEIPT
                                        ↓
                                 ADMIN DASHBOARD
```

## Stack

| Layer | Choice |
|---|---|
| Frontend / backend | Next.js 16 (App Router, Server Components, Route Handlers) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database / Auth / Realtime / Storage | Supabase (PostgreSQL 17) |
| Charts | Recharts |
| Deployment target | Vercel |

## Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: dashboard, orders, menu, inventory, users, payments, expenses, reports, activity log, QR locations, settings |
| **Cashier** | POS order entry, view/search orders, take payments, print + reprint receipts |
| **Kitchen** | Kitchen display, start preparing, mark ready, cancel |
| **Waiter** | Manual orders, live "ready" alerts, mark served |
| **Customer** | No login — scans a seat QR, orders, tracks status |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### Environment variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page — safe for the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → `service_role`. **Server-only.** Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build QR code links (e.g. `https://yourapp.vercel.app`) |

### Database

Migrations live in `supabase/migrations/` and are numbered in apply order. They
are already applied to the linked project. To provision a fresh project, run
them in order (Supabase SQL editor, `supabase db push`, or the MCP tooling).

### Demo staff accounts

Set `SEED_PASSWORD` in `.env.local` first, then:

```bash
npm run seed:users
```

Creates four accounts, each with the password you supplied:

| Role | Email |
|---|---|
| Admin | `admin@sandbox.test` |
| Cashier | `cashier@sandbox.test` |
| Kitchen | `kitchen@sandbox.test` |
| Waiter | `waiter@sandbox.test` |

> The password is read from the environment, never stored in this repository —
> these accounts exist on the deployed site, so a literal here would be a
> working admin login published in public source. Change or delete the accounts
> before real use; the script is dev-only and nothing in the app depends on it.

Customer ordering needs no account: open `/menu/seat-01` (seats `seat-01` …
`seat-08` are seeded), or print the QR codes from **Admin → QR Locations**.

## Architecture notes

### All order mutations go through SQL functions

Order creation, status transitions, payments and stock adjustments are
`SECURITY DEFINER` Postgres functions (`supabase/migrations/005_*.sql`):

- `place_qr_order` — anonymous customer ordering; prices are looked up
  server-side so a tampered client can't set its own prices
- `create_staff_order` — waiter/cashier/admin order entry
- `advance_order_status` — role-gated transitions, deducts or restores
  ingredient stock transactionally
- `record_payment` — validates the tendered amount, computes change, closes
  the order
- `adjust_stock` — admin purchase/waste/adjustment/return

Client roles only ever hold `SELECT` on those tables, so every write is
validated and audited in one place. Internal helpers (`_create_order_internal`,
`notify_role`, `log_activity`) have `EXECUTE` revoked from `anon`/`authenticated`
so they can't be called directly through PostgREST.

### Row Level Security

RLS is enabled on every table. Anonymous visitors can read the active menu and
seat list and nothing else — they never get direct access to `orders`. Customers
track their order through `get_order_tracking(access_token)`, where the token is
an unguessable per-order UUID.

### Realtime

Kitchen, waiter, cashier and admin screens subscribe to `postgres_changes` on
`orders` and `notifications`.

> **Gotcha worth knowing:** the browser Supabase client must be handed the
> signed-in user's access token before subscribing
> (`supabase.realtime.setAuth(session.access_token)`). Without it the socket
> authenticates with the anon key, Realtime evaluates RLS as `anon`, and every
> event is silently dropped — the subscription still reports success. Both
> realtime hooks do this explicitly.

The customer tracking page polls `get_order_tracking` every 4s instead of
subscribing, because anonymous clients deliberately have no RLS read path into
`orders`.

### Inventory

Products have recipes (`product_ingredients`). When the kitchen moves an order
to **PREPARING**, ingredients are deducted in one transaction; cancelling a
deducted order restores them. Stock can't go negative unless an admin enables
`allow_negative_stock` in settings. Every movement is written to
`inventory_transactions` with before/after quantities.

### Printing

`src/lib/printing/` is a model- and transport-agnostic printer gateway:

```
Cashier UI -> PrinterService -> PrinterAdapter -> printer
                    |
                 PrintQueue
```

Cashier components never build ESC/POS, never branch on connection type and
never import an adapter — swapping printers is a settings change.

| Connection type | Reaches | Platforms |
|---|---|---|
| `BROWSER` | Any OS-installed printer (fallback) | All |
| `BLUETOOTH_CLASSIC` | Classic/SPP portable printers, via RawBT | Android |
| `BLUETOOTH_BLE` | BLE printers, via Web Bluetooth | Chrome/Edge, **not iOS** |
| `LAN` | Wi-Fi/Ethernet printers on raw TCP 9100 | All (server must share the LAN) |
| `USB_BRIDGE` | USB/serial printers, via a bridge program | Windows/macOS/Linux |
| `WINDOWS_SYSTEM` | Vendor-driver printers via the OS dialog | Windows/macOS |
| `IOS_BRIDGE` | iPhone/iPad, via a network bridge | iOS |
| `RAWBT` | RawBT's USB/network/Bluetooth targets | Android |

**The constraint that shapes this:** Web Bluetooth speaks BLE GATT only and can
never reach a Bluetooth Classic (SPP/RFCOMM) printer — which many portable
receipt printers are. Hence the RawBT and bridge adapters.

Other properties:

- **One canonical receipt document** renders to both ESC/POS bytes and the HTML
  preview through the same layout engine, so the preview matches the paper.
- **Capability-gated commands** — a cutterless printer never receives `GS V`,
  a printer without QR support never receives QR data.
- **Configurable encoding** — CP437/CP850/CP858/CP1252, selected with `ESC t`.
  Never raw UTF-8, which prints as mojibake.
- **Print queue** — serialised, retrying, duplicate-protected; a failed job is
  parked with its error rather than silently lost.
- **Per-device selection** — printer definitions are shared; which one a device
  prints to is local to that device.
- Widths 58mm/80mm, feed lines, density, copies and capabilities are all
  configurable per printer, with roles for Receipt/Kitchen/Bar/Backup.

**Full setup, compatibility matrix and troubleshooting:
[docs/THERMAL-PRINTING.md](docs/THERMAL-PRINTING.md).**

> **Hardware status: no physical thermal printer has been tested.** 48 automated
> tests cover ESC/POS generation, the queue and every adapter, and the LAN route
> and bridge were verified byte-identical against mock TCP printers — but a real
> test print on your own hardware is the only true confirmation.

## Project layout

```
src/
  app/
    admin/      dashboard, orders, menu, inventory, locations, users,
                payments, expenses, reports, activity, settings
    cashier/    POS, orders, payments
    kitchen/    kitchen display
    waiter/     dashboard, manual order entry
    menu/[code] public QR ordering
    order/[accessToken]  public order tracking
    api/admin/  service-role user management routes
  components/   ui kit, layout shell, order builder, receipt
  lib/
    supabase/   browser / server / admin / middleware clients
    services/   data access (orders, menu, inventory, reports, …)
    hooks/      realtime orders, notifications
    printing/   PrinterService, print queue, receipt model,
                ESC/POS renderer, encodings, adapters/ + __tests__/
supabase/migrations/
scripts/
  seed-users.mjs     create demo staff accounts
  print-bridge.mjs   reference HTTP print bridge
docs/THERMAL-PRINTING.md
```

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # eslint
npm test             # ESC/POS unit tests (node:test, no extra deps)
npm run seed:users   # create the four demo accounts

# reference print bridge (see docs/THERMAL-PRINTING.md)
node scripts/print-bridge.mjs --target tcp://192.168.1.50:9100
```

## Before going to production

- [ ] Change or remove the demo accounts created by `npm run seed:users`
- [ ] Set `NEXT_PUBLIC_APP_URL` to the real domain so QR codes point at it,
      then re-print the codes from **Admin → QR Locations**
- [ ] Enable leaked-password protection: Supabase Dashboard → Authentication →
      Policies (checks passwords against HaveIBeenPwned)
- [ ] Rotate the `service_role` key if it has been shared anywhere
- [ ] Decide whether `007_seed_demo_data.sql` should be dropped — it seeds the
      demo menu, ingredients and seats

The Supabase security advisor will still report `SECURITY DEFINER` functions as
callable by `anon`/`authenticated`. That is intentional:
`is_staff`/`is_admin`/`current_profile_role` **must** stay executable or every
RLS policy that calls them fails, and they only report facts about the caller's
own session. `place_qr_order` and `get_order_tracking` are deliberately public
(that's QR ordering); both validate server-side and the latter requires an
unguessable token.

## Known gaps

- Bluetooth/bridge printing is architected and implemented but unverified
  against real hardware.
- Discounts exist on the schema (`orders.discount`) but there is no cashier UI
  for applying one yet; totals treat it as 0.
- Reports aggregate in TypeScript over fetched rows, which is fine at cafeteria
  scale but would want SQL-side aggregation for very large datasets.
