import type { CodePage } from "./types";

/**
 * ESC/POS printers render one byte per glyph from a selected code page. They
 * do not understand UTF-8 — sending it makes every non-ASCII character print
 * as two garbage glyphs. Text is therefore encoded to the printer's configured
 * code page here.
 */

/** Bytes 128..255 for each supported page, in order. */
const HIGH_RANGES: Record<CodePage, string> = {
  CP437:
    "ÇüéâäàåçêëèïîìÄÅ" +
    "ÉæÆôöòûùÿÖÜ¢£¥₧ƒ" +
    "áíóúñÑªº¿⌐¬½¼¡«»" +
    "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐" +
    "└┴┬├─┼╞╟╚╔╩╦╠═╬╧" +
    "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀" +
    "αßΓπΣσµτΦΘΩδ∞φε∩" +
    "≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ",
  CP850:
    "ÇüéâäàåçêëèïîìÄÅ" +
    "ÉæÆôöòûùÿÖÜø£Ø×ƒ" +
    "áíóúñÑªº¿®¬½¼¡«»" +
    "░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐" +
    "└┴┬├─┼ãÃ╚╔╩╦╠═╬¤" +
    "ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀" +
    "ÓßÔÒõÕµþÞÚÛÙýÝ¯´" +
    "­±‗¾¶§÷¸°¨·¹³²■ ",
  // CP858 is CP850 with the euro sign replacing the dotless i at 0xD5.
  CP858:
    "ÇüéâäàåçêëèïîìÄÅ" +
    "ÉæÆôöòûùÿÖÜø£Ø×ƒ" +
    "áíóúñÑªº¿®¬½¼¡«»" +
    "░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐" +
    "└┴┬├─┼ãÃ╚╔╩╦╠═╬¤" +
    "ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀" +
    "ÓßÔÒõÕµþÞÚÛÙýÝ¯´" +
    "­±‗¾¶§÷¸°¨·¹³²■ ",
  CP1252:
    "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
    "‘’“”•–—˜™š›œžŸ" +
    " ¡¢£¤¥¦§¨©ª«¬­®¯" +
    "°±²³´µ¶·¸¹º»¼½¾¿" +
    "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ" +
    "ÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß" +
    "àáâãäåæçèéêëìíîï" +
    "ðñòóôõö÷øùúûüýþÿ",
};

/** `ESC t n` selects the page; n differs per page. */
export const CODE_PAGE_COMMAND: Record<CodePage, number> = {
  CP437: 0,
  CP850: 2,
  CP858: 19,
  CP1252: 16,
};

const TABLES = new Map<CodePage, Map<string, number>>();

function tableFor(codePage: CodePage): Map<string, number> {
  const cached = TABLES.get(codePage);
  if (cached) return cached;

  const high = HIGH_RANGES[codePage];
  const table = new Map<string, number>();
  for (let i = 0; i < high.length; i++) {
    // First mapping wins so duplicates (e.g. padding chars) don't shadow.
    if (!table.has(high[i])) table.set(high[i], 128 + i);
  }
  TABLES.set(codePage, table);
  return table;
}

/**
 * Characters JavaScript and text editors emit constantly that are absent from
 * most code pages. Transliterating beats printing "?" on a receipt.
 */
const TRANSLITERATE: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  "•": "*",
  " ": " ",
  "™": "TM",
  "×": "x",
  "−": "-",
};

function deaccent(char: string): string {
  return char.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Encodes text to a single-byte code page. Unmappable characters degrade
 * gracefully — transliterate, then strip accents, then "?" — so a stray glyph
 * can never corrupt the byte stream or desynchronise column alignment.
 */
export function encodeText(text: string, codePage: CodePage = "CP437"): number[] {
  const table = tableFor(codePage);
  const out: number[] = [];

  for (const char of text) {
    const direct = table.get(char);

    // The euro sign is native to CP1252/CP858 but not CP437/CP850.
    if (char === "€" && direct === undefined) {
      out.push(...encodeText("EUR", codePage));
      continue;
    }

    const replacement = TRANSLITERATE[char];
    if (replacement !== undefined && direct === undefined) {
      for (const c of replacement) out.push(c.charCodeAt(0) & 0x7f);
      continue;
    }

    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code);
      continue;
    }
    if (direct !== undefined) {
      out.push(direct);
      continue;
    }

    const stripped = deaccent(char);
    if (stripped && stripped !== char) {
      out.push(...encodeText(stripped, codePage));
      continue;
    }

    out.push(0x3f); // '?'
  }

  return out;
}

/**
 * Printed column count. Single-byte encodings make this the encoded length,
 * which is what column alignment must be measured against (not String.length,
 * which miscounts combining marks and astral characters).
 */
export function printedWidth(text: string, codePage: CodePage = "CP437"): number {
  return encodeText(text, codePage).length;
}

export const SUPPORTED_CODE_PAGES: { value: CodePage; label: string }[] = [
  { value: "CP437", label: "CP437 — USA / standard (default)" },
  { value: "CP850", label: "CP850 — Western European" },
  { value: "CP858", label: "CP858 — Western European + €" },
  { value: "CP1252", label: "CP1252 — Windows Latin-1" },
];
