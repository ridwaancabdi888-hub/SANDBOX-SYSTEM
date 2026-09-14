// Generates the installable-app icons from the cafeteria logo.
//
//   node scripts/generate-pwa-icons.mjs <logo.png> [--favicon-crop=left,top,size]
//
// The logo an admin uploads lives in Supabase Storage and can change at any
// time, but browsers install an app with icons that must be static files. So
// this is run by hand when the logo changes, and the output is committed.
//
// Outputs
//   public/icons/icon-192.png            manifest, purpose "any"
//   public/icons/icon-512.png            manifest, purpose "any"
//   public/icons/icon-maskable-192.png   manifest, purpose "maskable"
//   public/icons/icon-maskable-512.png   manifest, purpose "maskable"
//   src/app/apple-icon.png               iOS home-screen icon (180x180)
//   src/app/favicon.ico                  browser tab (16/32/48)
//
// `sharp` ships with Next.js, so no extra dependency is needed.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
if (!source) {
  console.error("usage: node scripts/generate-pwa-icons.mjs <logo.png> [--favicon-crop=left,top,size]");
  process.exit(1);
}
const cropArg = args.find((a) => a.startsWith("--favicon-crop="));
const faviconCrop = cropArg
  ? (([left, top, size]) => ({ left, top, width: size, height: size }))(cropArg.split("=")[1].split(",").map(Number))
  : null;

const ROOT = process.cwd();
const out = (...p) => {
  const file = join(ROOT, ...p);
  mkdirSync(dirname(file), { recursive: true });
  return file;
};

// Pad with the logo's own background so maskable crops and letterboxing are
// invisible rather than a white or black band.
const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
};
const corner = at(4, 4);
const background = { ...corner, alpha: 1 };

const png = (img) => img.png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 });

async function square(size, file) {
  await png(sharp(source).resize(size, size, { fit: "contain", background })).toFile(out(...file));
}

// Android masks icons to a circle or squircle; only the centre 80% is safe.
// The logo is shrunk to 72% so the cup and wordmark survive any mask shape.
async function maskable(size, file) {
  const inner = Math.round(size * 0.72);
  const logo = await sharp(source).resize(inner, inner, { fit: "contain", background }).toBuffer();
  await png(
    sharp({ create: { width: size, height: size, channels: 4, background } }).composite([{ input: logo, gravity: "center" }])
  ).toFile(out(...file));
}

await square(192, ["public", "icons", "icon-192.png"]);
await square(512, ["public", "icons", "icon-512.png"]);
await maskable(192, ["public", "icons", "icon-maskable-192.png"]);
await maskable(512, ["public", "icons", "icon-maskable-512.png"]);
await square(180, ["src", "app", "apple-icon.png"]);

// favicon.ico holds PNG frames. At 16-48px a wordmark is unreadable, so the
// favicon can use a tighter crop (e.g. just the cup) via --favicon-crop.
const faviconBase = faviconCrop ? sharp(source).extract(faviconCrop) : sharp(source);
const faviconSource = await faviconBase.png().toBuffer();
const frames = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    // ICO decoders (including Next.js's) require RGBA frames, even for an
    // opaque logo — without ensureAlpha() sharp would write RGB.
    buf: await sharp(faviconSource).resize(size, size, { fit: "contain", background }).ensureAlpha().png().toBuffer(),
  }))
);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(frames.length, 4);
let offset = 6 + 16 * frames.length;
const entries = frames.map(({ size, buf }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0); // width
  e.writeUInt8(size, 1); // height
  e.writeUInt8(0, 2); // palette colours
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
writeFileSync(out("src", "app", "favicon.ico"), Buffer.concat([header, ...entries, ...frames.map((f) => f.buf)]));

const hex = "#" + [corner.r, corner.g, corner.b].map((v) => v.toString(16).padStart(2, "0")).join("");
console.log(`Icons written. Logo background ${hex} — use it as the manifest background_color.`);
