import type { RasterImage, ReceiptWidth } from "./types";

/** Printable head width in dots at 203 dpi — the near-universal ESC/POS head. */
export function headWidthDots(paperWidth: ReceiptWidth): number {
  return paperWidth === 58 ? 384 : 576;
}

/**
 * Rasterised logos, keyed by URL + target width.
 *
 * A receipt printer needs a 1-bit bitmap, which means decoding the image and
 * thresholding it — far too slow to redo for every receipt, and the logo
 * changes about once a year.
 */
const cache = new Map<string, RasterImage>();

/** Only meaningful in a browser: decoding needs Image + canvas. */
export function canRasterize(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof Image !== "undefined" &&
    typeof document.createElement === "function"
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Supabase Storage serves permissive CORS; without this the canvas is
    // tainted and getImageData throws a SecurityError.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the logo image."));
    image.src = url;
  });
}

/**
 * Converts a logo URL into a 1-bit bitmap sized for the printer head.
 *
 * Width is rounded down to a multiple of 8 because ESC/POS packs eight
 * horizontal pixels per byte; aspect ratio is preserved, and the height is
 * capped so a tall logo cannot eat the whole roll.
 *
 * Returns null rather than throwing when rasterising isn't possible — a logo
 * is decoration, and a receipt must still print without it.
 */
export async function rasterizeLogo(
  url: string,
  paperWidth: ReceiptWidth,
  maxHeightDots = 240
): Promise<RasterImage | null> {
  if (!url || !canRasterize()) return null;

  const headWidth = headWidthDots(paperWidth);
  const cacheKey = `${url}|${headWidth}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const image = await loadImage(url);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) return null;

    // Logos print at half the head width or less — full-bleed looks wrong and
    // wastes paper on a 58mm roll.
    let targetWidth = Math.min(naturalWidth, Math.floor(headWidth * 0.6));
    targetWidth = Math.max(8, targetWidth - (targetWidth % 8));
    let targetHeight = Math.max(1, Math.round((naturalHeight / naturalWidth) * targetWidth));

    if (targetHeight > maxHeightDots) {
      const scale = maxHeightDots / targetHeight;
      targetHeight = maxHeightDots;
      targetWidth = Math.max(8, Math.floor((targetWidth * scale) / 8) * 8);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    // Flatten transparency onto white: an alpha=0 pixel has undefined RGB and
    // would otherwise threshold to solid black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const { data } = context.getImageData(0, 0, targetWidth, targetHeight);
    const bytesPerRow = targetWidth / 8;
    const bitmap = new Uint8Array(bytesPerRow * targetHeight);

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const i = (y * targetWidth + x) * 4;
        const alpha = data[i + 3] / 255;
        const luminance =
          (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha +
          255 * (1 - alpha);
        // A set bit burns a dot, so dark pixels become 1.
        if (luminance < 128) {
          bitmap[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }

    const raster: RasterImage = { width: targetWidth, height: targetHeight, data: bitmap };
    cache.set(cacheKey, raster);
    return raster;
  } catch {
    // Unreachable URL, CORS refusal, decode failure — print without the logo.
    return null;
  }
}
