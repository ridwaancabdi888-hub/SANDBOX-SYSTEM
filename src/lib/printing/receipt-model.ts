import { printedWidth } from "./encoding";
import type {
  CodePage,
  PrinterProfile,
  RasterImage,
  ReceiptData,
  ReceiptWidth,
} from "./types";

/**
 * THE canonical receipt representation.
 *
 * A receipt is built once into these blocks, then rendered to ESC/POS bytes,
 * to the HTML preview, or to a bridge payload. Transports never re-derive
 * layout, so what the cashier sees on screen is what the printer produces.
 */
export type ReceiptAlign = "left" | "center" | "right";

export type ReceiptBlock =
  | { type: "logo"; url: string; image?: RasterImage | null }
  | { type: "title"; text: string }
  | { type: "text"; text: string; align?: ReceiptAlign; bold?: boolean }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "divider" }
  | { type: "blank" }
  | { type: "qr"; data: string }
  | { type: "barcode"; data: string };

export interface ReceiptDoc {
  blocks: ReceiptBlock[];
  widthMm: ReceiptWidth;
  columns: number;
  encoding: CodePage;
}

/** Printable columns at Font A. */
export function charsPerLine(widthMm: ReceiptWidth): number {
  return widthMm === 58 ? 32 : 48;
}

export function truncate(text: string, width: number, codePage: CodePage = "CP437"): string {
  if (printedWidth(text, codePage) <= width) return text;
  let out = "";
  for (const char of text) {
    if (printedWidth(out + char, codePage) > width) break;
    out += char;
  }
  return out;
}

/** Word wrap, hard-splitting words longer than a line. */
export function wrapText(text: string, width: number, codePage: CodePage = "CP437"): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (printedWidth(candidate, codePage) <= width) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      let remainder = word;
      while (printedWidth(remainder, codePage) > width) {
        const head = truncate(remainder, width, codePage);
        lines.push(head);
        remainder = remainder.slice(head.length);
      }
      current = remainder;
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

/**
 * Left/right justified row. Both sides are truncated so the result can never
 * exceed the line width — an overflowing row wraps on the printer and breaks
 * the alignment of every column below it.
 */
export function layoutRow(
  left: string,
  right: string,
  width: number,
  codePage: CodePage = "CP437"
): string {
  const rightText = truncate(right, width, codePage);
  const leftBudget = Math.max(0, width - printedWidth(rightText, codePage) - 1);
  const leftText = truncate(left, leftBudget, codePage);
  const gap = Math.max(
    1,
    width - printedWidth(leftText, codePage) - printedWidth(rightText, codePage)
  );
  return leftText + " ".repeat(gap) + rightText;
}

function money(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Flattens blocks into the exact printed lines. Both renderers use this, which
 * is what guarantees the preview and the paper agree character for character.
 */
export function layoutBlocks(doc: ReceiptDoc): {
  block: ReceiptBlock;
  lines: string[];
}[] {
  const { columns, encoding } = doc;

  return doc.blocks.map((block) => {
    switch (block.type) {
      case "title":
        // Double-width glyphs occupy two columns, so titles wrap at half width.
        return { block, lines: wrapText(block.text, Math.floor(columns / 2), encoding) };
      case "text":
        return { block, lines: wrapText(block.text, columns, encoding) };
      case "row":
        return { block, lines: [layoutRow(block.left, block.right, columns, encoding)] };
      case "divider":
        return { block, lines: ["-".repeat(columns)] };
      case "blank":
        return { block, lines: [""] };
      case "logo":
      case "qr":
      case "barcode":
        // Rendered natively by each transport, so they contribute no text.
        return { block, lines: [] };
    }
  });
}

/**
 * Builds the canonical document for a receipt or a kitchen/bar ticket.
 * Capability flags decide whether QR/barcode blocks are emitted at all.
 */
export function buildReceiptDoc(data: ReceiptData, profile: PrinterProfile): ReceiptDoc {
  const columns = charsPerLine(profile.paperWidth);
  const blocks: ReceiptBlock[] = [];
  const isTicket = data.variant === "TICKET";

  // The logo sits above the name rather than replacing it: on a monochrome
  // 58mm roll a logo alone is often unreadable, and a printer that can't do
  // images drops the block entirely (see the ESC/POS renderer).
  if (data.logoUrl) {
    blocks.push({ type: "logo", url: data.logoUrl, image: data.logo ?? null });
  }
  blocks.push({ type: "title", text: data.cafeteriaName });
  if (!isTicket) {
    if (data.header) blocks.push({ type: "text", text: data.header, align: "center" });
    if (data.address) blocks.push({ type: "text", text: data.address, align: "center" });
    if (data.phone) blocks.push({ type: "text", text: data.phone, align: "center" });
  } else {
    blocks.push({ type: "text", text: "KITCHEN TICKET", align: "center", bold: true });
  }
  if (data.reprint) {
    blocks.push({ type: "text", text: "*** REPRINT ***", align: "center", bold: true });
  }
  blocks.push({ type: "divider" });

  blocks.push({ type: "text", text: `Order #: ${data.orderNumber}` });
  blocks.push({ type: "text", text: `Date: ${data.date}` });
  if (!isTicket) blocks.push({ type: "text", text: `Cashier: ${data.cashierName}` });
  if (data.locationName) blocks.push({ type: "text", text: `Location: ${data.locationName}` });
  blocks.push({ type: "text", text: `Source: ${data.source}` });
  blocks.push({ type: "divider" });

  for (const item of data.items) {
    if (isTicket) {
      // Tickets emphasise quantity and drop pricing entirely.
      blocks.push({ type: "text", text: `${item.quantity} x ${item.name}`, bold: true });
    } else {
      blocks.push({ type: "text", text: item.name });
      blocks.push({
        type: "row",
        left: `  ${item.quantity} x ${money(item.unitPrice)}`,
        right: money(item.subtotal),
      });
    }
    if (item.note) blocks.push({ type: "text", text: `  NOTE: ${item.note}` });
  }
  blocks.push({ type: "divider" });

  if (!isTicket) {
    blocks.push({ type: "row", left: "SUBTOTAL", right: money(data.subtotal) });
    if (data.discount > 0) {
      blocks.push({ type: "row", left: "DISCOUNT", right: `-${money(data.discount)}` });
    }
    blocks.push({
      type: "row",
      left: "TOTAL",
      right: `${data.currency} ${money(data.total)}`,
      bold: true,
    });
    blocks.push({ type: "row", left: "PAYMENT", right: data.paymentMethod });
    blocks.push({ type: "row", left: "PAID", right: money(data.amountPaid) });
    blocks.push({ type: "row", left: "CHANGE", right: money(data.changeAmount) });
    blocks.push({ type: "divider" });
  }

  // Only emit codes the printer can actually render.
  if (!isTicket && profile.capabilities.supportsQRCode && data.orderNumber > 0) {
    blocks.push({ type: "qr", data: `SANDBOX-ORDER-${data.orderNumber}` });
  }

  blocks.push({
    type: "text",
    text: isTicket ? "— END OF TICKET —" : data.footer || "THANK YOU!",
    align: "center",
    bold: isTicket,
  });

  return { blocks, widthMm: profile.paperWidth, columns, encoding: profile.encoding };
}
