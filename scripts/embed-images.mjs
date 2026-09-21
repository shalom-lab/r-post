#!/usr/bin/env node
/**
 * 将 Markdown 中相对路径图片转为 data URI 内嵌，便于 Pages 预览与后续公众号。
 * 用法: node scripts/embed-images.mjs content/posts/001-example/001-example.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mimeOf(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

function embed(mdPath) {
  const abs = path.resolve(mdPath);
  const dir = path.dirname(abs);
  let md = fs.readFileSync(abs, "utf8");

  md = md.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (full, alt, src) => {
      const clean = src.trim().replace(/^<|>$/g, "").split(/\s+/)[0];
      if (/^(https?:|data:)/i.test(clean)) return full;
      const imgPath = path.resolve(dir, clean);
      if (!fs.existsSync(imgPath)) {
        console.warn(`跳过缺失图片: ${clean}`);
        return full;
      }
      const buf = fs.readFileSync(imgPath);
      const data = `data:${mimeOf(imgPath)};base64,${buf.toString("base64")}`;
      return `![${alt}](${data})`;
    },
  );

  fs.writeFileSync(abs, md, "utf8");
  console.log(`已内嵌图片: ${abs}`);
}

const target = process.argv[2];
if (!target) {
  console.error("用法: node scripts/embed-images.mjs <markdown-file>");
  process.exit(1);
}
embed(target);
