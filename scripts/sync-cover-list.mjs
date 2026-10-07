#!/usr/bin/env node
/**
 * 对照 content/index.json 同步 cover/cover.json：
 * - 新文章 → 追加，active: false
 * - 已有 → 更新 title；active:true 且图片丢失 → 降为 inactive
 * - 不删除 cover.json 里多出的旧 id（仅 note 提示）
 *
 *   node scripts/sync-cover-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "content", "index.json");
const coverJsonPath = path.join(root, "cover", "cover.json");
const imagesDir = path.join(root, "cover", "images");

function imageExists(rel) {
  if (!rel) return false;
  const full = path.join(root, "cover", rel.replace(/^\.\//, ""));
  return fs.existsSync(full);
}

const articles = JSON.parse(fs.readFileSync(indexPath, "utf8")).articles || [];
let store = { covers: [], updatedAt: null };
if (fs.existsSync(coverJsonPath)) {
  store = JSON.parse(fs.readFileSync(coverJsonPath, "utf8"));
}
const byId = new Map((store.covers || []).map((c) => [c.id, c]));

const next = [];
let added = 0;
let demoted = 0;

for (const a of articles) {
  const id = a.id;
  const prev = byId.get(id);
  if (!prev) {
    next.push({
      id,
      title: a.title,
      image: null,
      active: false,
      note: "待制作",
    });
    added += 1;
    continue;
  }

  const row = {
    ...prev,
    title: a.title || prev.title,
  };

  if (row.active && !imageExists(row.image)) {
    row.active = false;
    row.image = null;
    row.note = "图片缺失，已降为 inactive";
    demoted += 1;
  }

  next.push(row);
  byId.delete(id);
}

const orphanNotes = [];
for (const [id, row] of byId) {
  next.push({
    ...row,
    note: row.note
      ? `${row.note}；不在 content/index.json`
      : "不在 content/index.json",
  });
  orphanNotes.push(id);
}

store.covers = next;
store.updatedAt = new Date().toISOString();
fs.mkdirSync(imagesDir, { recursive: true });
fs.writeFileSync(coverJsonPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

console.log(
  `同步封面清单：文章 ${articles.length} · 清单 ${next.length} · 新增 ${added} · 降级 ${demoted}` +
    (orphanNotes.length ? ` · 残留 ${orphanNotes.length}` : ""),
);

const { spawnSync } = await import("node:child_process");
const r = spawnSync(process.execPath, [path.join(root, "scripts", "update-cover-md.mjs")], {
  stdio: "inherit",
});
process.exit(r.status ?? 0);
