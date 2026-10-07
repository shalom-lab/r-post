#!/usr/bin/env node
/**
 * 将封面图居中裁成 900×383（比 900/383），原地覆盖（只保留裁后结果）。
 * 纯 Node（sharp），云端 / 本地 npm ci 后可用。
 *
 * 与 cover/rules.md 两色蒙版一致（16:9 出图，黑带≈未来裁切窗）：
 *   保留高度 = (16/9)/(900/383) = 6128/8100 → 75.65%
 *   上下各裁 = 493/4050 → 12.17%（对应参考图白带）
 *
 *   node scripts/crop-cover-235.mjs cover/images/<id>.jpg
 *   node scripts/crop-cover-235.mjs
 *   npm run crop-cover
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imagesDir = path.join(root, "cover", "images");
const RATIO = 900 / 383;
const OUT_W = 900;
const OUT_H = 383;

function listDefault() {
  return fs
    .readdirSync(imagesDir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && f !== ".gitkeep")
    .map((f) => path.join(imagesDir, f));
}

function resolveArgs(argv) {
  const raw = argv.slice(2);
  if (raw.length === 0) return listDefault();
  const out = [];
  for (const a of raw) {
    if (a.includes("*")) continue;
    const p = path.isAbsolute(a) ? a : path.resolve(process.cwd(), a);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) out.push(p);
  }
  return out.length ? out : listDefault();
}

async function cropOne(filePath) {
  const img = sharp(filePath);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error(`无法读取尺寸: ${filePath}`);

  const cur = w / h;
  let left = 0;
  let top = 0;
  let cw = w;
  let ch = h;

  if (Math.abs(cur - RATIO) >= 0.005 || w !== OUT_W || h !== OUT_H) {
    if (cur > RATIO) {
      cw = Math.round(h * RATIO);
      left = Math.floor((w - cw) / 2);
      ch = h;
      top = 0;
    } else {
      ch = Math.round(w / RATIO);
      top = Math.floor((h - ch) / 2);
      cw = w;
      left = 0;
    }
  } else {
    console.log("skip", filePath, `${w}x${h}`);
    return;
  }

  const outPath = /\.jpe?g$/i.test(filePath)
    ? filePath
    : filePath.replace(/\.[^.]+$/i, ".jpg");

  await sharp(filePath)
    .extract({ left, top, width: cw, height: ch })
    .resize(OUT_W, OUT_H, { fit: "fill" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath + ".tmp");

  fs.renameSync(outPath + ".tmp", outPath);
  if (outPath !== filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  console.log("ok", outPath, `${OUT_W}x${OUT_H}`);
}

const files = resolveArgs(process.argv);
if (!files.length) {
  console.error("没有找到要处理的图片");
  process.exit(1);
}

for (const f of files) {
  try {
    await cropOne(f);
  } catch (e) {
    console.error("fail", f, e.message ?? e);
    process.exit(1);
  }
}
