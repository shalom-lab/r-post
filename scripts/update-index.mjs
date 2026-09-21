#!/usr/bin/env node
/** Scan content/posts and generate the read-only article manifest. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const indexPath = path.join(root, "content", "index.json");

function unquote(value = "") {
  return value.trim().replace(/^["']|["']$/g, "");
}

function frontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) continue;
    const [, key, raw] = pair;
    if (raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
      result[key] = raw
        .trim()
        .slice(1, -1)
        .split(",")
        .map((item) => unquote(item))
        .filter(Boolean);
    } else {
      result[key] = unquote(raw);
    }
  }
  return result;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

const articles = [];
if (fs.existsSync(postsDir)) {
  for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = path.join(postsDir, entry.name);
    const qmdName = fs.readdirSync(folder).find((name) => name.endsWith(".qmd"));
    if (!qmdName) continue;
    const number = entry.name.match(/^(\d+)/)?.[1] || "";
    const qmdPath = path.join(folder, qmdName);
    const mdName = qmdName.replace(/\.qmd$/, ".md");
    const mdPath = path.join(folder, mdName);
    const meta = frontmatter(fs.readFileSync(qmdPath, "utf8"));
    articles.push({
      id: number || entry.name,
      slug: entry.name,
      title: meta.title || qmdName.replace(/\.qmd$/, ""),
      description: meta.description || "",
      date: meta.date || "",
      category: meta.category || "",
      categorySlug: meta["category-slug"] || "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      qmd: toPosix(path.relative(path.join(root, "content"), qmdPath)),
      md: fs.existsSync(mdPath)
        ? toPosix(path.relative(path.join(root, "content"), mdPath))
        : null,
    });
  }
}

articles.sort((a, b) => Number(b.id) - Number(a.id));
fs.writeFileSync(
  indexPath,
  `${JSON.stringify({ articles, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8",
);
console.log(`更新文章清单：${articles.length} 篇 → ${indexPath}`);
