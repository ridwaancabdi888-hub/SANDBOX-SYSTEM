import type { ReceiptData, ReceiptWidth } from "./types";

/**
 * Deterministic sample used by "Print Test Receipt".
 *
 * Deliberately exercises the things that break on real hardware: a long
 * wrapping item name, an item note, a decimal-heavy totals block and an
 * accented character (to prove the code page is right, not UTF-8).
 */
export function buildSampleReceipt(widthMm: ReceiptWidth, transportLabel: string): ReceiptData {
  return {
    cafeteriaName: "SANDBOX",
    header: "PRINTER TEST",
    address: "Alignment + encoding check",
    orderNumber: 0,
    date: new Date().toLocaleString(),
    cashierName: "System",
    locationName: "Test Bench",
    source: transportLabel,
    items: [
      { name: "Chicken Meal", quantity: 2, unitPrice: 6.5, subtotal: 13.0, note: "no onion" },
      { name: "Café Cappuccino", quantity: 1, unitPrice: 2.5, subtotal: 2.5 },
      {
        name: "Long item name that must wrap onto another line cleanly",
        quantity: 1,
        unitPrice: 1.25,
        subtotal: 1.25,
      },
    ],
    subtotal: 16.75,
    discount: 0,
    total: 16.75,
    paymentMethod: "CASH",
    amountPaid: 20,
    changeAmount: 3.25,
    currency: "USD",
    widthMm,
  };
}
