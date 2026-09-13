import { CODE_PAGE_COMMAND, encodeText } from "./encoding";
import { layoutBlocks, type ReceiptAlign, type ReceiptDoc } from "./receipt-model";
import type { PrinterProfile, RasterImage } from "./types";
import type { ReceiptBlock } from "./receipt-model";

const ESC = 0x1b;
const GS = 0x1d;

export const CMD = {
  INIT: [ESC, 0x40],
  codePage: (n: number) => [ESC, 0x74, n],
  align: (a: ReceiptAlign) => [ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  /** GS ! 0x11 — double width and height; halves column capacity. */
  DOUBLE_ON: [GS, 0x21, 0x11],
  DOUBLE_OFF: [GS, 0x21, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x42, 0x00],
  DRAWER_KICK: [ESC, 0x70, 0x00, 0x19, 0xfa],
  feed: (lines: number) => [ESC, 0x64, Math.max(0, Math.min(255, lines))],
  /** GS ( K — print density, where supported. */
  density: (value: number) => [GS, 0x28, 0x4b, 0x02, 0x00, 0x31, Math.max(0, Math.min(2, value))],
};

/** GS k — CODE128. Falls back to nothing if the payload isn't printable. */
function barcodeCommand(data: string): number[] {
  const payload = encodeText(data, "CP437").filter((b) => b >= 0x20 && b <= 0x7e);
  if (!payload.length) return [];
  return [
    GS, 0x68, 0x50,          // height 80 dots
    GS, 0x77, 0x02,          // module width
    GS, 0x48, 0x02,          // print HRI below
    GS, 0x6b, 0x49,          // CODE128
    payload.length + 2, 0x7b, 0x42, // {B code set
    ...payload,
  ];
}

/**
 * GS v 0 — raster bit image.
 *
 * `GS v 0 m xL xH yL yH d1…dk`, where x is the row width **in bytes** and y the
 * row count. Returns nothing for a malformed bitmap rather than emitting a
 * truncated image, which would desynchronise every byte that follows.
 */
function rasterCommand(image: RasterImage): number[] {
  const bytesPerRow = Math.ceil(image.width / 8);
  if (bytesPerRow <= 0 || image.height <= 0) return [];
  if (image.data.length < bytesPerRow * image.height) return [];
  // xH/yH are single bytes, so 2047 dots wide and 65535 tall is the ceiling.
  if (bytesPerRow > 0xff || image.height > 0xffff) return [];

  return [
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    image.height & 0xff, (image.height >> 8) & 0xff,
    ...image.data.subarray(0, bytesPerRow * image.height),
  ];
}

/** GS ( k — model 2 QR code. */
function qrCommand(data: string, moduleSize = 6): number[] {
  const bytes = encodeText(data, "CP437");
  const length = bytes.length + 3;
  const pL = length & 0xff;
  const pH = (length >> 8) & 0xff;

  return [
    GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // model 2
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize, // module size
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,       // error correction L
    GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...bytes, // store data
    GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,       // print
  ];
}

/**
 * Renders the canonical document to ESC/POS bytes.
 *
 * Capability-gated throughout: a cutterless printer never receives GS V, a
 * printer without QR support gets its QR block skipped rather than a burst of
 * literal control characters, and so on.
 */
export function renderEscPos(doc: ReceiptDoc, profile: PrinterProfile): Uint8Array {
  const bytes: number[] = [];
  const push = (command: number[]) => bytes.push(...command);
  const { capabilities, encoding } = profile;

  const writeLine = (text: string) => {
    bytes.push(...encodeText(text, encoding), 0x0a);
  };

  push(CMD.INIT);
  push(CMD.codePage(CODE_PAGE_COMMAND[encoding]));
  if (profile.connection.density !== undefined) {
    push(CMD.density(profile.connection.density));
  }

  let currentAlign: ReceiptAlign = "left";
  const setAlign = (align: ReceiptAlign) => {
    if (align === currentAlign) return;
    push(CMD.align(align));
    currentAlign = align;
  };

  for (const { block, lines } of layoutBlocks(doc)) {
    switch (block.type) {
      case "logo": {
        // Two independent gates: the printer must claim image support, and a
        // bitmap must actually have been produced for it. Either missing and
        // the receipt prints as text — never as garbage.
        if (!capabilities.supportsImages || !block.image) break;
        const command = rasterCommand(block.image);
        if (!command.length) break;
        setAlign("center");
        push(command);
        bytes.push(0x0a);
        break;
      }
      case "title": {
        setAlign("center");
        if (capabilities.supportsBold) push(CMD.BOLD_ON);
        push(CMD.DOUBLE_ON);
        lines.forEach(writeLine);
        push(CMD.DOUBLE_OFF);
        if (capabilities.supportsBold) push(CMD.BOLD_OFF);
        break;
      }
      case "text": {
        setAlign(block.align ?? "left");
        const bold = block.bold && capabilities.supportsBold;
        if (bold) push(CMD.BOLD_ON);
        lines.forEach(writeLine);
        if (bold) push(CMD.BOLD_OFF);
        break;
      }
      case "row": {
        setAlign("left");
        const bold = block.bold && capabilities.supportsBold;
        if (bold) push(CMD.BOLD_ON);
        lines.forEach(writeLine);
        if (bold) push(CMD.BOLD_OFF);
        break;
      }
      case "divider":
      case "blank": {
        setAlign("left");
        lines.forEach(writeLine);
        break;
      }
      case "qr": {
        if (!capabilities.supportsQRCode) break;
        setAlign("center");
        push(qrCommand(block.data));
        bytes.push(0x0a);
        break;
      }
      case "barcode": {
        if (!capabilities.supportsBarcode) break;
        setAlign("center");
        push(barcodeCommand(block.data));
        bytes.push(0x0a);
        break;
      }
    }
  }

  // Feed past the tear bar — on a cutterless printer this is what makes the
  // receipt detachable without tearing through the footer.
  push(CMD.feed(profile.feedLines));
  if (capabilities.supportsCut) push(CMD.CUT_PARTIAL);
  push(CMD.align("left"));

  return new Uint8Array(bytes);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export type { ReceiptBlock };
