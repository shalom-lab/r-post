#!/usr/bin/env node
/**
 * 封面收成约 2.35:1 高清成品，原地覆盖。
 *
 * 目标像素：**至少** 1800×766（900×383 的 2 倍；比例同 900/383）。
 * 豆包直出常见 ~3008×1280：比例对且已达目标 → **整段跳过**，保留更高清原图。
 *
 * - 已 ≥1800×766 且比例约 2.35:1 → 跳过
 * - 比例约 2.35:1 但偏小 → 只 resize 到 1800×766（不裁构图）
 * - 比例差太多（如 16:9）→ 居中裁成 2.35:1，再 resize 到 1800×766
 *
 *   node scripts/crop-cover-235.mjs cover/images/<id>.jpg
 *   npm run crop-cover
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imagesDir = path.join(root, "cover", "images");
/** 与历史微信大图 900×383 同比例 */
const RATIO = 900 / 383;
const RATIO_TOL = 0.02;
/** 入库最低清晰度（2×）；更大且比例对的原图直接保留 */
const OUT_W = 1800;
const OUT_H = 766;

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
  const ratioOk = Math.abs(cur - RATIO) <= RATIO_TOL;
  const bigEnough = w >= OUT_W && h >= OUT_H;

  if (ratioOk && bigEnough) {
    console.log(
      "skip",
      filePath,
      `${w}x${h}`,
      `already ≥${OUT_W}x${OUT_H} ~2.35:1`,
    );
    return;
  }

  const outPath = /\.jpe?g$/i.test(filePath)
    ? filePath
    : filePath.replace(/\.[^.]+$/i, ".jpg");

  let pipeline = sharp(filePath);

  if (ratioOk) {
    pipeline = pipeline.resize(OUT_W, OUT_H, { fit: "fill" });
    console.log(
      "resize-only",
      filePath,
      `${w}x${h} (ratio ${cur.toFixed(4)}) → ${OUT_W}x${OUT_H}`,
    );
  } else {
    let left = 0;
    let top = 0;
    let cw = w;
    let ch = h;
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
    pipeline = pipeline
      .extract({ left, top, width: cw, height: ch })
      .resize(OUT_W, OUT_H, { fit: "fill" });
    console.log(
      "crop+resize",
      filePath,
      `${w}x${h} (ratio ${cur.toFixed(4)}) → ${OUT_W}x${OUT_H}`,
    );
  }

  await pipeline.jpeg({ quality: 92, mozjpeg: true }).toFile(outPath + ".tmp");

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
