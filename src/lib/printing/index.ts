export * from "./types";
export { encodeText, printedWidth, SUPPORTED_CODE_PAGES, CODE_PAGE_COMMAND } from "./encoding";
export {
  buildReceiptDoc,
  charsPerLine,
  layoutBlocks,
  layoutRow,
  wrapText,
  truncate,
  type ReceiptBlock,
  type ReceiptDoc,
  type ReceiptAlign,
} from "./receipt-model";
export { renderEscPos, toBase64 } from "./escpos-renderer";
export { PrintQueue, printQueue } from "./queue";
export { PrinterService, createPrinterService, getAdapter, type PrintRequest } from "./printer-service";
export {
  buildReceiptData,
  type ReceiptSource,
  type ReceiptSettings,
} from "./receipt-builder";
export { rasterizeLogo, headWidthDots, canRasterize } from "./raster";
export { buildSampleReceipt } from "./sample-receipt";

import type { ConnectionType } from "./types";

export interface ConnectionTypeInfo {
  value: ConnectionType;
  label: string;
  /** Plain-language description for a cafeteria owner, not a developer. */
  blurb: string;
  /** Fields the settings form must collect for this transport. */
  fields: ("host" | "port" | "bridgeUrl" | "bleUuids")[];
  platforms: string;
}

/**
 * Presented in the order a typical user should consider them: the universal
 * fallback first, then the transports most likely to match real hardware.
 */
export const CONNECTION_TYPES: ConnectionTypeInfo[] = [
  {
    value: "BROWSER",
    label: "Browser / system print dialog",
    blurb:
      "Always works. Prints through your device's normal print dialog to any printer the system already knows about.",
    fields: [],
    platforms: "Android · Windows · macOS · iOS · any browser",
  },
  {
    value: "BLUETOOTH_CLASSIC",
    label: "Bluetooth printer (most portable printers)",
    blurb:
      "For the common pocket/portable printers that pair with a PIN. Uses the free RawBT app on Android, which can talk to Bluetooth Classic printers that browsers cannot reach directly.",
    fields: [],
    platforms: "Android only",
  },
  {
    value: "BLUETOOTH_BLE",
    label: "Bluetooth Low Energy (BLE) printer",
    blurb:
      "For newer Bluetooth LE printers. Connects straight from Chrome or Edge — no extra app. Not available on iPhone or iPad.",
    fields: ["bleUuids"],
    platforms: "Android · Windows · macOS · Linux (Chrome/Edge, HTTPS)",
  },
  {
    value: "LAN",
    label: "Network printer (Wi-Fi / Ethernet)",
    blurb:
      "For printers with their own IP address, using raw ESC/POS on port 9100. The SANDBOX server sends the job, so it must share the printer's network.",
    fields: ["host", "port"],
    platforms: "Any device · requires a self-hosted server on the same LAN",
  },
  {
    value: "USB_BRIDGE",
    label: "USB printer (via print bridge)",
    blurb:
      "For a printer plugged into a counter PC. Browsers cannot drive USB printers directly, so a small bridge program on that PC forwards the job.",
    fields: ["bridgeUrl"],
    platforms: "Windows · macOS · Linux (bridge runs on the PC)",
  },
  {
    value: "WINDOWS_SYSTEM",
    label: "Windows / macOS installed printer",
    blurb:
      "Use the printer's own driver installed in Windows or macOS. Prints through the system dialog; set the paper size to your receipt roll.",
    fields: [],
    platforms: "Windows · macOS",
  },
  {
    value: "IOS_BRIDGE",
    label: "iPhone / iPad (via network bridge)",
    blurb:
      "iOS browsers cannot use Bluetooth at all. Point this at a bridge on your network, or use a network printer or the browser print dialog instead.",
    fields: ["bridgeUrl"],
    platforms: "iOS · iPadOS",
  },
  {
    value: "RAWBT",
    label: "RawBT (advanced Android)",
    blurb:
      "Sends jobs to the RawBT Android app explicitly. Same as the Bluetooth option above, but also covers RawBT's USB and network targets.",
    fields: [],
    platforms: "Android only",
  },
];

export function connectionTypeInfo(type: ConnectionType): ConnectionTypeInfo {
  return CONNECTION_TYPES.find((t) => t.value === type) ?? CONNECTION_TYPES[0];
}
