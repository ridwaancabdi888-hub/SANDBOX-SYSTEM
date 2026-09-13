import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderEscPos } from "../escpos-renderer";
import { buildReceiptDoc } from "../receipt-model";
import { headWidthDots } from "../raster";
import type { RasterImage } from "../types";
import { GS, hasSequence, makeProfile, makeReceipt, textLines, withCapabilities } from "./helpers";

const LOGO_URL = "https://example.supabase.co/storage/v1/object/public/branding/logo/a.png";

/** A solid 16x2 block: 2 bytes per row, 4 bytes total. */
function solidLogo(width = 16, height = 2): RasterImage {
  const bytesPerRow = width / 8;
  return {
    width,
    height,
    data: new Uint8Array(bytesPerRow * height).fill(0xff),
  };
}

const RASTER_CMD = [GS, 0x76, 0x30, 0x00];

describe("receipt logo", () => {
  test("prints the raster when the printer supports images", () => {
    const profile = withCapabilities({ supportsImages: true });
    const doc = buildReceiptDoc(
      makeReceipt({ logoUrl: LOGO_URL, logo: solidLogo() }),
      profile
    );
    const bytes = renderEscPos(doc, profile);

    assert.ok(hasSequence(bytes, RASTER_CMD), "GS v 0 was not emitted");
    // 16 dots wide = 2 bytes per row, 2 rows.
    assert.ok(
      hasSequence(bytes, [...RASTER_CMD, 0x02, 0x00, 0x02, 0x00]),
      "raster header did not describe the bitmap"
    );
  });

  test("omits the raster when the printer cannot print images", () => {
    const profile = withCapabilities({ supportsImages: false });
    const bytes = renderEscPos(
      buildReceiptDoc(makeReceipt({ logoUrl: LOGO_URL, logo: solidLogo() }), profile),
      profile
    );

    assert.ok(!hasSequence(bytes, RASTER_CMD), "sent an image to a printer that can't print one");
  });

  test("falls back to text when the logo could not be rasterised", () => {
    // What happens when the image is unreachable, CORS-blocked, or the
    // transport never rasterises: URL present, bitmap absent.
    const profile = withCapabilities({ supportsImages: true });
    const bytes = renderEscPos(
      buildReceiptDoc(makeReceipt({ logoUrl: LOGO_URL, logo: null }), profile),
      profile
    );

    assert.ok(!hasSequence(bytes, RASTER_CMD));
    assert.ok(
      textLines(bytes).some((line) => line.includes("SANDBOX")),
      "the receipt lost its heading along with the logo"
    );
  });

  test("a truncated bitmap is dropped rather than desynchronising the stream", () => {
    const profile = withCapabilities({ supportsImages: true });
    const broken: RasterImage = { width: 16, height: 4, data: new Uint8Array(2) };
    const bytes = renderEscPos(
      buildReceiptDoc(makeReceipt({ logoUrl: LOGO_URL, logo: broken }), profile),
      profile
    );

    assert.ok(!hasSequence(bytes, RASTER_CMD));
    const lines = textLines(bytes);
    assert.ok(lines.some((line) => line.includes("Order #: 1042")));
    assert.ok(lines.some((line) => line.includes("TOTAL")));
  });

  test("no logo configured leaves the byte stream unchanged", () => {
    const profile = withCapabilities({ supportsImages: true });
    const withoutLogo = renderEscPos(buildReceiptDoc(makeReceipt(), profile), profile);
    assert.ok(!hasSequence(withoutLogo, RASTER_CMD));
  });

  test("the logo block never consumes text columns", () => {
    const profile = withCapabilities({ supportsImages: true });
    const columns = 32; // 58mm
    const bytes = renderEscPos(
      buildReceiptDoc(makeReceipt({ logoUrl: LOGO_URL, logo: solidLogo() }), profile),
      profile
    );

    for (const line of textLines(bytes)) {
      assert.ok(line.length <= columns, `line overflowed the paper: ${JSON.stringify(line)}`);
    }
  });

  test("head width matches the paper size", () => {
    assert.equal(headWidthDots(58), 384);
    assert.equal(headWidthDots(80), 576);
  });

  test("kitchen tickets can carry the logo too", () => {
    const profile = withCapabilities({ supportsImages: true });
    const bytes = renderEscPos(
      buildReceiptDoc(
        makeReceipt({ logoUrl: LOGO_URL, logo: solidLogo(), variant: "TICKET" }),
        profile
      ),
      profile
    );
    assert.ok(hasSequence(bytes, RASTER_CMD));
  });

  test("default profiles do not claim image support", () => {
    // Images are opt-in: many printers ignore or mangle GS v 0, so an admin
    // has to tick the box after testing their own hardware.
    assert.equal(makeProfile().capabilities.supportsImages, false);
  });
});
