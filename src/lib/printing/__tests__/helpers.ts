import { DEFAULT_CAPABILITIES } from "../types";
import type { PrinterCapabilities, PrinterProfile, ReceiptData } from "../types";

export const ESC = 0x1b;
export const GS = 0x1d;

export function makeProfile(overrides: Partial<PrinterProfile> = {}): PrinterProfile {
  return {
    id: "test-printer",
    name: "Test Printer",
    role: "RECEIPT",
    connectionType: "BROWSER",
    paperWidth: 58,
    encoding: "CP437",
    capabilities: { ...DEFAULT_CAPABILITIES, ...(overrides.capabilities ?? {}) },
    connection: {},
    feedLines: 4,
    copies: 1,
    autoReconnect: true,
    isDefault: true,
    active: true,
    ...overrides,
  };
}

export function withCapabilities(caps: Partial<PrinterCapabilities>): PrinterProfile {
  return makeProfile({ capabilities: { ...DEFAULT_CAPABILITIES, ...caps } });
}

export function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    cafeteriaName: "SANDBOX",
    header: "CAFETERIA",
    footer: "THANK YOU!",
    address: "123 Main Street",
    phone: "+252 61 000 0000",
    orderNumber: 1042,
    date: "Sep 12, 2026, 10:41 PM",
    cashierName: "Cade Cashier",
    locationName: "Seat 05",
    source: "QR_CUSTOMER",
    items: [{ name: "Chicken Meal", quantity: 2, unitPrice: 6.5, subtotal: 13, note: null }],
    subtotal: 13,
    discount: 0,
    total: 13,
    paymentMethod: "Cash",
    amountPaid: 20,
    changeAmount: 7,
    currency: "USD",
    widthMm: 58,
    ...overrides,
  };
}

/**
 * Extracts the printable text lines from an ESC/POS stream, skipping command
 * sequences — this is what a printer would actually put on paper.
 */
export function textLines(bytes: Uint8Array): string[] {
  const lines: string[] = [];
  let current: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];

    if (byte === ESC || byte === GS) {
      const next = bytes[i + 1];
      if (byte === ESC && next === 0x40) i += 1;
      else if (byte === ESC && [0x61, 0x45, 0x74, 0x64].includes(next)) i += 2;
      else if (byte === GS && next === 0x21) i += 2;
      else if (byte === GS && next === 0x56) i += 3;
      else if (byte === GS && next === 0x28) {
        // GS ( fn pL pH ... — length-prefixed block.
        const pL = bytes[i + 3];
        const pH = bytes[i + 4];
        i += 4 + (pL | (pH << 8));
      } else if (byte === GS && next === 0x6b) {
        // GS k m n data — CODE128 with explicit length.
        const len = bytes[i + 3];
        i += 3 + len;
      } else if (byte === GS && next === 0x76 && bytes[i + 2] === 0x30) {
        // GS v 0 m xL xH yL yH d1…dk — raster image.
        const xL = bytes[i + 4];
        const xH = bytes[i + 5];
        const yL = bytes[i + 6];
        const yH = bytes[i + 7];
        i += 7 + (xL | (xH << 8)) * (yL | (yH << 8));
      } else if (byte === GS && [0x68, 0x77, 0x48].includes(next)) i += 2;
      else i += 1;
      continue;
    }

    if (byte === 0x0a) {
      lines.push(String.fromCharCode(...current));
      current = [];
      continue;
    }
    current.push(byte);
  }

  if (current.length) lines.push(String.fromCharCode(...current));
  return lines;
}

export function hasSequence(bytes: Uint8Array, sequence: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) continue outer;
    }
    return true;
  }
  return false;
}
