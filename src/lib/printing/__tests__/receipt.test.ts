import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encodeText, printedWidth } from "../encoding";
import { buildReceiptDoc, charsPerLine, layoutRow, wrapText } from "../receipt-model";
import { renderEscPos, toBase64 } from "../escpos-renderer";
import { buildSampleReceipt } from "../sample-receipt";
import {
  ESC,
  GS,
  hasSequence,
  makeProfile,
  makeReceipt,
  textLines,
  withCapabilities,
} from "./helpers";

function render(receipt = makeReceipt(), profile = makeProfile()) {
  return renderEscPos(buildReceiptDoc(receipt, profile), profile);
}

describe("encoding", () => {
  test("encodes ASCII one byte per character", () => {
    assert.deepEqual(encodeText("ABC"), [65, 66, 67]);
  });

  test("encodes accented Latin as a single byte, not UTF-8", () => {
    // 'é' is 0x82 in CP437 but two bytes in UTF-8 — the original bug.
    assert.deepEqual(encodeText("é", "CP437"), [0x82]);
    assert.equal(encodeText("Café", "CP437").length, 4);
  });

  test("honours the selected code page", () => {
    // 'é' sits at a different byte in CP1252 than CP437.
    assert.deepEqual(encodeText("é", "CP1252"), [0xe9]);
    assert.notDeepEqual(encodeText("é", "CP437"), encodeText("é", "CP1252"));
  });

  test("CP858 maps the euro sign natively, CP437 transliterates it", () => {
    assert.deepEqual(encodeText("€", "CP858"), [0xd5]);
    assert.equal(String.fromCharCode(...encodeText("€", "CP437")), "EUR");
  });

  test("transliterates typographic characters", () => {
    assert.deepEqual(encodeText("’"), [0x27]);
    assert.deepEqual(encodeText("—"), [0x2d]);
  });

  test("degrades unmappable characters safely instead of corrupting output", () => {
    for (const byte of encodeText("日本語 ñ é ü")) {
      assert.ok(byte >= 0 && byte <= 255, `byte ${byte} out of range`);
    }
    assert.equal(String.fromCharCode(...encodeText("ă")), "a");
  });

  test("printedWidth counts printed columns", () => {
    assert.equal(printedWidth("Café"), 4);
  });
});

describe("layout", () => {
  test("wrapText never exceeds the width and keeps every word", () => {
    const text = "Grilled chicken with rice and extra special sauce";
    const lines = wrapText(text, 20);
    for (const line of lines) assert.ok(line.length <= 20);
    const joined = lines.join(" ");
    for (const word of text.split(" ")) assert.ok(joined.includes(word));
  });

  test("wrapText hard-splits words longer than a line", () => {
    for (const line of wrapText("Supercalifragilisticexpialidocious", 10)) {
      assert.ok(line.length <= 10);
    }
  });

  test("layoutRow truncates instead of overflowing the line", () => {
    const row = layoutRow("A very long label indeed", "1234567890", 20);
    assert.equal(row.length, 20);
    assert.ok(row.endsWith("1234567890"));
  });
});

describe("receipt rendering", () => {
  for (const width of [58, 80] as const) {
    test(`no printed line exceeds the ${width}mm width`, () => {
      const columns = charsPerLine(width);
      const bytes = render(
        makeReceipt({
          cafeteriaName: "SANDBOX CAFETERIA VERY LONG BRAND NAME",
          items: [
            {
              name: "Extremely long product name that definitely exceeds one printed line",
              quantity: 12,
              unitPrice: 1234.56,
              subtotal: 14814.72,
              note: "a very long customer note that also has to wrap correctly",
            },
          ],
        }),
        makeProfile({ paperWidth: width })
      );

      for (const line of textLines(bytes)) {
        assert.ok(
          line.length <= columns,
          `line of ${line.length} cols exceeds ${columns}: ${JSON.stringify(line)}`
        );
      }
    });
  }

  test("totals row keeps label and amount on one line", () => {
    const line = textLines(render()).find((l) => l.startsWith("TOTAL"));
    assert.ok(line?.includes("USD 13.00"), `unexpected total row: ${line}`);
  });

  test("paid and change are formatted to 2dp", () => {
    const lines = textLines(render());
    assert.ok(lines.some((l) => l.startsWith("PAID") && l.includes("20.00")));
    assert.ok(lines.some((l) => l.startsWith("CHANGE") && l.includes("7.00")));
  });

  test("discount row only appears when non-zero", () => {
    assert.ok(!textLines(render()).some((l) => l.startsWith("DISCOUNT")));
    const withDiscount = textLines(render(makeReceipt({ discount: 2.5 })));
    assert.ok(withDiscount.find((l) => l.startsWith("DISCOUNT"))?.includes("-2.50"));
  });

  test("reprints are stamped so they can't pass as a new sale", () => {
    assert.ok(!textLines(render()).some((l) => l.includes("REPRINT")));
    assert.ok(
      textLines(render(makeReceipt({ reprint: true }))).some((l) => l.includes("REPRINT"))
    );
  });

  test("kitchen tickets show quantities and omit money", () => {
    const lines = textLines(render(makeReceipt({ variant: "TICKET" })));
    assert.ok(lines.some((l) => l.includes("KITCHEN TICKET")));
    assert.ok(lines.some((l) => l.includes("2 x Chicken Meal")));
    assert.ok(!lines.some((l) => l.startsWith("TOTAL")));
    assert.ok(!lines.some((l) => l.startsWith("CHANGE")));
  });
});

describe("capabilities gate commands", () => {
  test("omits the cut command on a cutterless printer", () => {
    const bytes = render(makeReceipt(), withCapabilities({ supportsCut: false }));
    assert.ok(!hasSequence(bytes, [GS, 0x56, 0x42, 0x00]), "cut sent to a cutterless printer");
  });

  test("emits the cut command when the printer has a cutter", () => {
    const bytes = render(makeReceipt(), withCapabilities({ supportsCut: true }));
    assert.ok(hasSequence(bytes, [GS, 0x56, 0x42, 0x00]));
  });

  test("omits QR data when the printer cannot print QR codes", () => {
    const withQr = render(makeReceipt(), withCapabilities({ supportsQRCode: true }));
    const withoutQr = render(makeReceipt(), withCapabilities({ supportsQRCode: false }));
    assert.ok(withQr.length > withoutQr.length, "QR block was not emitted when supported");
    assert.ok(!hasSequence(withoutQr, [GS, 0x28, 0x6b]), "QR command sent to a printer without QR");
  });

  test("omits bold commands when the printer lacks bold", () => {
    const bytes = render(makeReceipt(), withCapabilities({ supportsBold: false }));
    assert.ok(!hasSequence(bytes, [ESC, 0x45, 0x01]), "bold sent to a printer without bold");
  });

  test("always initialises and selects the configured code page", () => {
    const bytes = render(makeReceipt(), makeProfile({ encoding: "CP858" }));
    assert.ok(hasSequence(bytes, [ESC, 0x40]), "missing ESC @ init");
    assert.ok(hasSequence(bytes, [ESC, 0x74, 19]), "missing CP858 selection");
  });

  test("feeds the configured number of lines and ends left-aligned", () => {
    const bytes = render(makeReceipt(), makeProfile({ feedLines: 6 }));
    assert.ok(hasSequence(bytes, [ESC, 0x64, 6]));
    assert.deepEqual(Array.from(bytes.slice(-3)), [ESC, 0x61, 0x00]);
  });

  test("emits density only when configured", () => {
    const without = render();
    assert.ok(!hasSequence(without, [GS, 0x28, 0x4b]));
    const withDensity = render(
      makeReceipt(),
      makeProfile({ connection: { density: 2 } })
    );
    assert.ok(hasSequence(withDensity, [GS, 0x28, 0x4b]));
  });
});

describe("transport helpers", () => {
  test("base64 round-trips the byte stream", () => {
    const bytes = render();
    assert.deepEqual(Array.from(Buffer.from(toBase64(bytes), "base64")), Array.from(bytes));
  });

  test("sample receipt stays within both paper widths", () => {
    for (const width of [58, 80] as const) {
      const profile = makeProfile({ paperWidth: width });
      const bytes = renderEscPos(buildReceiptDoc(buildSampleReceipt(width, "TEST"), profile), profile);
      for (const line of textLines(bytes)) {
        assert.ok(line.length <= charsPerLine(width));
      }
    }
  });
});
