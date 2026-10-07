#!/usr/bin/env node
/**
 * 封面收成 900×383（比例 900/383 ≈ 2.35:1），原地覆盖。
 *
 * 行为（兼容豆包直出与其他模型）：
 * - 已是 900×383 → 跳过
 * - 比例已约 2.35:1（允许误差）→ **不居中裁构图**，只 resize 到 900×383
 *   （豆包等直出横封面常走这条）
 * - 比例差太多（如 16:9）→ 居中裁成 2.35:1，再 resize
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
/** |w/h - RATIO| 不超过此值，视为「已经大约是 2.35:1」 */
const RATIO_TOL = 0.02;
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
  const ratioOk = Math.abs(cur - RATIO) <= RATIO_TOL;
  const sizeOk = w === OUT_W && h === OUT_H;

  if (ratioOk && sizeOk) {
    console.log("skip", filePath, `${w}x${h}`, "already 900x383 ~2.35:1");
    return;
  }

  const outPath = /\.jpe?g$/i.test(filePath)
    ? filePath
    : filePath.replace(/\.[^.]+$/i, ".jpg");

  let pipeline = sharp(filePath);

  if (ratioOk) {
    // 豆包等：比例已对，只压到成品像素，不裁构图
    pipeline = pipeline.resize(OUT_W, OUT_H, { fit: "fill" });
    console.log(
      "resize-only",
      filePath,
      `${w}x${h} (ratio ${cur.toFixed(4)}) → ${OUT_W}x${OUT_H}`,
    );
  } else {
    // 其他模型（如 16:9）：居中裁成 2.35:1 再压
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

  await pipeline.jpeg({ quality: 90, mozjpeg: true }).toFile(outPath + ".tmp");

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
