#!/usr/bin/env node
/**
 * 由 cover/cover.json 生成 cover/cover.md（勿手改 md）
 *   node scripts/update-cover-md.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "cover", "cover.json");
const mdPath = path.join(root, "cover", "cover.md");

const store = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const covers = store.covers || [];
const activeCount = covers.filter((c) => c.active && c.image).length;
const inactiveCount = covers.length - activeCount;

const lines = [
  "# RPost 封面一览",
  "",
  "> 由 `cover/cover.json` 生成；改清单后运行 `node scripts/update-cover-md.mjs`。",
  ">",
  `> 合计 **${covers.length}** 篇 · 已启用 **${activeCount}** · 待制作（inactive）**${inactiveCount}**`,
  "",
];

for (const item of covers) {
  const status = item.active && item.image ? "启用" : "inactive";
  lines.push(`## ${item.title}`);
  lines.push("");
  lines.push(`- id：\`${item.id}\``);
  lines.push(`- 状态：**${status}**`);
  if (item.image) {
    lines.push(`- 文件：\`${item.image}\``);
    lines.push("");
    lines.push(`![${item.title}](${item.image})`);
  } else {
    lines.push(`- 文件：（无）`);
    lines.push("");
    lines.push("_尚无封面图。_");
  }
  if (item.note) {
    lines.push("");
    lines.push(`> ${item.note}`);
  }
  lines.push("");
}

fs.writeFileSync(mdPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
console.log(`更新封面视图：${covers.length} 条 → ${mdPath}`);
