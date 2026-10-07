import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "cover", "templates");
fs.mkdirSync(outDir, { recursive: true });

const W = 1920;
const H = 1080; // 16:9
const RATIO = 900 / 383;
const bandH = Math.round(W / RATIO);
const top = Math.floor((H - bandH) / 2);
const bottom = H - top - bandH;
const outFile = path.join(outDir, "ref-16x9-black235-white-margins.jpg");

console.log({
  W,
  H,
  bandH,
  top,
  bottom,
  whitePct: ((top / H) * 100).toFixed(2),
  blackPct: ((bandH / H) * 100).toFixed(2),
});

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect y="${top}" width="${W}" height="${bandH}" fill="#111111"/>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(outFile);
console.log("ok", outFile);
