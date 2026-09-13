# Thermal printing guide

How to connect SANDBOX to a receipt printer, what works where, and what to do
when it doesn't.

SANDBOX aims to support the **widest practical range of common ESC/POS thermal
printers** — not literally every printer. The architecture is model-agnostic:
you pick a connection type, enter the connection details, choose the paper
width, and test. Adding a new printer should never require code changes.

---

## 1. Compatibility matrix

| Connection type | Android | Windows | macOS | iOS / iPadOS | Needs |
|---|---|---|---|---|---|
| **Browser / system dialog** | ✅ | ✅ | ✅ | ✅ | Nothing — always available |
| **Bluetooth Classic (SPP)** | ✅ via RawBT | ❌ | ❌ | ❌ | RawBT app |
| **Bluetooth BLE** | ✅ Chrome/Edge | ✅ Chrome/Edge | ✅ Chrome/Edge | ❌ *(no iOS browser has Web Bluetooth)* | HTTPS + BLE printer |
| **Network / LAN (TCP 9100)** | ✅ | ✅ | ✅ | ✅ | Self-hosted server on the printer's LAN |
| **USB (via bridge)** | — | ✅ | ✅ | — | Bridge program on that PC |
| **Windows/macOS installed printer** | — | ✅ | ✅ | — | Vendor driver installed |
| **iOS bridge** | — | — | — | ✅ | Bridge on the network |

Legend: ✅ supported · ❌ impossible on that platform · — not applicable.

### The one fact that decides everything

Portable Bluetooth receipt printers come in two **incompatible** flavours:

| Type | Typical sign | Browser access |
|---|---|---|
| **Bluetooth Classic (SPP/RFCOMM)** | Pairs with a PIN (`0000`/`1234`) | **Impossible from any browser** |
| **Bluetooth Low Energy (BLE/GATT)** | Pairs without a PIN, or not visible in classic pairing | Chrome/Edge only |

Web Bluetooth — the only Bluetooth API browsers expose — speaks **BLE GATT
only**. If your printer is Classic/SPP, no browser on any OS can reach it, and
you must use **RawBT** (Android) or a **bridge**. This is a platform
limitation, not something SANDBOX can code around.

**How to tell which you have:** in the app, choose *Bluetooth Low Energy (BLE)*
and press **Connect**. If your printer appears in the chooser and connects,
it's BLE. If it's missing from the list, or connects then reports "no writable
characteristic", it's Classic — switch to the Bluetooth Classic option.

---

## 2. Setting up a printer

**Admin → Settings → Printers** (full configuration) or
**Cashier → Printer** (select, connect, test).

1. **Add** a printer (or edit the default).
2. Give it a **name** and choose what it's **used for** — Receipt, Kitchen, Bar
   or Backup.
3. Choose **how it's connected**. The form then asks only for the fields that
   transport needs.
4. Set **paper width** — 58mm (32 characters) or 80mm (48 characters).
5. Tick the **capabilities** your printer actually has (see §5).
6. **Connect**, then **Print Test Receipt**.

Printer definitions are shared across the cafeteria. **Which** printer a given
device prints to is stored per device, so the counter tablet and the manager's
laptop can use different hardware while signed in as the same user.

---

## 3. Connection types

### Browser / system print dialog — the universal fallback
Prints through the OS dialog to any printer the system knows about, including
a thermal printer installed with a vendor driver. Set the paper size in the
dialog. Doesn't use ESC/POS — the driver rasterises the page — so cut/QR
capability flags don't apply.

### Bluetooth Classic → RawBT (Android)
The common case for pocket printers.

1. Install **RawBT print service** from Google Play (`ru.a402d.rawbtprinter`).
2. Pair the printer in **Android Settings → Bluetooth**.
3. Open RawBT, select the printer, run its own test print.
4. In SANDBOX choose **Bluetooth printer (most portable printers)**.
5. **Print Test Receipt**.

Jobs are handed to RawBT through an Android intent URL; if RawBT isn't
installed the browser is redirected to its Play Store page.

> **Constraint:** the handoff is one-way. SANDBOX gets no completion callback,
> so it can't detect paper-out or an offline printer — those appear in RawBT.

### Bluetooth BLE — direct from the browser
Requires Chrome/Edge, **HTTPS**, a real tap to open the chooser, and (on
Android) Location enabled for BLE scanning.

SANDBOX lists **all** nearby devices rather than filtering by service UUID —
most printers omit it from their advertisement, and filtering would show an
empty chooser. After connecting it scans every GATT service for a writable
characteristic, trying five well-known ESC/POS service UUIDs first. If your
printer needs specific UUIDs you can override them in the form.

Data is written in 20-byte chunks (the guaranteed BLE payload), preferring
write-without-response and falling back to write-with-response.

### Network / LAN / Ethernet — raw TCP 9100
For printers with their own IP address. Enter the **IP** and **port**
(9100 by default), press **Connect** to probe it, then test.

Browsers cannot open TCP sockets, so jobs are relayed by the SANDBOX server
(`/api/print/lan`). **This means the server must share a network with the
printer:**

- Self-hosted / on-premise → works
- Cloud host (Vercel etc.) → cannot reach a private LAN IP; use a **bridge**
  on a counter machine instead

For safety the route only accepts private/loopback addresses
(10.x, 172.16–31.x, 192.168.x, 127.x, `*.local`) and known printer ports
(9100–9102, 515, 631), so it can't be used to probe the public internet.

### USB / iOS → print bridge
A small HTTP server on the machine that owns the printer. Ships at
`scripts/print-bridge.mjs`.

```bash
node scripts/print-bridge.mjs --target tcp://192.168.1.50:9100   # network printer
node scripts/print-bridge.mjs --target serial://COM3             # USB (Windows)
node scripts/print-bridge.mjs --target serial:///dev/usb/lp0     # USB (Linux)
node scripts/print-bridge.mjs --target stdout                    # dry run
```

Then set **Bridge URL** to `http://<that-machine-ip>:8080`.

Any program implementing this contract works:

```
GET  /status -> 200 {"ok": true, "printer": "<description>"}
POST /print  -> 200 {"ok": true}      body: {"base64": "<ESC/POS bytes>"}
```

> **Mixed content:** an HTTPS page cannot call a plain-HTTP bridge. Run the app
> over HTTP on the LAN, put HTTPS in front of the bridge, or use `localhost`
> (browsers treat it as secure).

**Why USB needs a bridge:** browsers cannot claim a USB interface the OS
printer driver already owns, so WebUSB is not a viable path for arbitrary USB
thermal printers.

**Building an Android bridge for Classic/SPP** (only if RawBT isn't enough):
a foreground service that opens an RFCOMM socket with the SPP UUID
`00001101-0000-1000-8000-00805F9B34FB`, runs an embedded HTTP server
implementing the contract above, writes the decoded base64 to the socket's
`OutputStream`, and holds `BLUETOOTH_CONNECT` (Android 12+) plus a wake lock.

---

## 4. Receipt format and encoding

One canonical receipt document is built per order, then rendered to ESC/POS
bytes **or** to the on-screen preview by the same layout engine — so the
preview matches the paper character for character.

- **Width:** 32 columns (58mm) or 48 columns (80mm), Font A.
- **Wrapping:** long product names wrap; label/amount rows truncate rather
  than overflow, which would otherwise break every column below.
- **Encoding:** **CP437** by default, selected on the printer with `ESC t 0`.
  CP850, CP858 (with €) and CP1252 are also selectable.

Sending UTF-8 — the obvious-looking approach — prints two garbage glyphs for
every non-ASCII character. Unmappable characters degrade safely: transliterate
(`'` `-` `...` `EUR`), then strip accents, then `?`.

> Non-Latin scripts (e.g. Arabic) cannot be represented by these code pages.
> That needs a printer-specific code page and matching encoder, or raster
> image printing.

---

## 5. Capabilities

Commands are only emitted when the printer claims the capability, so a
cutterless printer never receives a cut command:

| Capability | Effect when off |
|---|---|
| `supportsCut` | `GS V` is never sent; paper is fed past the tear bar instead |
| `supportsQRCode` | QR block skipped entirely |
| `supportsBarcode` | Barcode block skipped |
| `supportsBold` | Bold on/off commands omitted |
| `supportsDrawer` | No drawer-kick pulse |
| `supportsImages` | No raster output |

Also configurable: **feed lines** after the receipt (increase if the footer
stays inside the printer), **print density**, and **copies**.

Default is `supportsCut: false` — most small portable printers have no cutter.

### Printing your logo

Upload it under **Settings → Branding**. It then appears on the browser/system
print receipt automatically.

For an ESC/POS printer you must additionally tick **Supports images** on that
printer. The logo is converted to a 1-bit bitmap sized to the print head (384
dots at 58mm, 576 at 80mm), scaled to 60% of the head width with its aspect
ratio preserved, and sent as `GS v 0`.

`supportsImages` is off by default on purpose: printers vary widely in raster
support, and one that ignores `GS v 0` can print a page of noise. Tick it, run
**Print Test Receipt**, and untick it if the result isn't clean. If the logo
can't be loaded or converted for any reason, the receipt prints as text — it
never fails over a decoration.

---

## 6. Print queue and reliability

Jobs are queued per device and printed **one at a time in submission order**,
so a burst of orders can't interleave mid-receipt.

- **Duplicate protection:** a receipt carries an idempotency key, so a
  double-tap prints once.
- **Retry:** transient failures retry with backoff.
- **Never silently lost:** an exhausted job is parked as `FAILED` with its
  error and a **Retry** button, visible in the Print queue panel.
- **Fallback:** when a printer errors the UI offers *Retry*, *Choose another
  printer*, and *Use browser print*.

Statuses: `QUEUED → PRINTING → PRINTED`, or `FAILED` / `CANCELLED`.

The queue is per device, because the browser holds the printer connection.

---

## 7. Reprinting

Any **completed** order has a printer button in **Cashier → Orders**. The
receipt is rebuilt from the stored order and payment rows — never from screen
state — and is stamped `*** REPRINT ***` in both the preview and the printed
output so it can't be passed off as a second sale.

---

## 8. Multiple printers

Each printer has a **role**: Receipt, Kitchen, Bar or Backup, with one default
per role. Kitchen/Bar tickets render a different document — large quantities,
item notes, and no pricing.

The kitchen-ticket document and roles are implemented; automatic routing of
tickets to the kitchen printer on order creation is not yet wired up.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Device chooser is empty | Printer is Classic/SPP, off, or out of range | Use the Bluetooth Classic (RawBT) option |
| "No writable characteristic" | Not a BLE ESC/POS printer | Use RawBT or a bridge |
| Only half the receipt prints | Chunks exceeded the negotiated MTU, or buffer overrun | Reprint; report so chunk size can be lowered |
| Garbled accented characters | Printer isn't on the selected code page | Check the printer's self-test page, try CP850/CP1252 |
| Text runs past the paper edge | Wrong width selected | Match 58mm / 80mm to your roll |
| Last line stuck in the printer | Not enough feed | Increase **Feed lines after receipt** |
| Stray characters at the end | Cut sent to a cutterless printer | Untick **Has an auto-cutter** |
| LAN printer unreachable | Server isn't on the printer's network | Self-host, or use a bridge |
| "Only local network addresses are allowed" | Public IP entered | Printers must be on a private LAN |
| Bridge times out | Not running, wrong IP, or firewalled | Open `http://<ip>:8080/status` in a browser |
| HTTPS page can't reach bridge | Mixed-content blocking | See §3 |
| Nothing happens on iOS Bluetooth | No iOS browser implements Web Bluetooth | Use LAN or a bridge |

---

## 10. Hardware verification status

**No physical thermal printer has been tested.** Be sceptical of any claim
otherwise — treat a successful **Print Test Receipt** on your own hardware as
the real confirmation.

What *is* verified automatically (`npm test`, 65 tests):

| Area | Verified |
|---|---|
| ESC/POS generation | Encoding across 4 code pages, wrapping, column alignment at 58mm and 80mm, capability gating of cut/QR/bold, code-page selection, feed, density |
| Receipt model | Reprint stamp, kitchen-ticket variant, discount rows, totals formatting |
| Logo printing | `GS v 0` raster header, skipped when `supportsImages` is off, text fallback when the bitmap is missing or truncated, logo never consuming text columns |
| Print queue | Ordering, no concurrency, duplicate prevention, retry, failure parking, manual retry, cancellation |
| Bridge adapter | Byte-identical delivery to a mock bridge, printer-side failure, unreachable bridge, missing configuration |
| LAN adapter | Correct relay payload, offline-printer error handling, missing IP |
| RawBT / Browser adapters | Platform support detection and refusal to print when unsupported |

Additionally verified against **mock printers** (not unit tests):

- The `/api/print/lan` route delivered a **byte-identical** ESC/POS stream to a
  real TCP socket on port 9100, returned a clear error for an offline printer,
  and refused public IPs and non-printer ports.
- `scripts/print-bridge.mjs` delivered a **679-byte receipt byte-identical** to
  a mock TCP printer and returned HTTP 500 when the printer was unreachable.

Not verified: Bluetooth BLE against a real printer, RawBT on a real Android
device, and print quality/alignment on actual paper.
