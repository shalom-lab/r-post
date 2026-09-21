#!/usr/bin/env node
/**
 * 扫描 content/drafts/*.qmd 与 content/published/*.md，更新 content/index.json
 * 若 .last-generate.json 含 topicId，则在索引更新后标记选题已成稿
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "content", "index.json");
const draftsDir = path.join(root, "content", "drafts");
const publishedDir = path.join(root, "content", "published");
const lastPath = path.join(root, "content", ".last-generate.json");
const topicsPath = path.join(root, "topics", "index.json");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--slug") out.slug = argv[++i] ?? "";
  }
  return out;
}

function titleFromQmd(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const ym = m[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return ym ? ym[1].trim() : null;
}

function listSlugs() {
  const set = new Set();
  if (fs.existsSync(draftsDir)) {
    for (const f of fs.readdirSync(draftsDir)) {
      if (f.endsWith(".qmd")) set.add(f.replace(/\.qmd$/, ""));
    }
  }
  if (fs.existsSync(publishedDir)) {
    for (const f of fs.readdirSync(publishedDir)) {
      if (f.endsWith(".md")) set.add(f.replace(/\.md$/, ""));
    }
  }
  return [...set].sort();
}

function loadIndex() {
  if (!fs.existsSync(indexPath)) return { articles: [] };
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

function markTopicDone(slug, topicId) {
  if (!topicId || !fs.existsSync(topicsPath)) return;
  const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
  const item = (store.items || []).find((i) => i.id === topicId);
  if (!item) return;
  item.articleId = slug;
  item.updatedAt = new Date().toISOString();
  store.updatedAt = item.updatedAt;
  fs.writeFileSync(topicsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`选题已标记成稿: ${topicId} → ${slug}`);
}

function main() {
  const { slug: focus } = parseArgs(process.argv);
  const prev = loadIndex();
  const byId = new Map((prev.articles || []).map((a) => [a.id, a]));
  let last = {};
  if (fs.existsSync(lastPath)) {
    try {
      last = JSON.parse(fs.readFileSync(lastPath, "utf8"));
    } catch {
      last = {};
    }
  }
  const slugs = listSlugs();
  const now = new Date().toISOString();

  const articles = slugs.map((id) => {
    const qmdPath = path.join(draftsDir, `${id}.qmd`);
    const mdPath = path.join(publishedDir, `${id}.md`);
    const old = byId.get(id) || {};
    let title = old.title || id;
    if (fs.existsSync(qmdPath)) {
      const t = titleFromQmd(fs.readFileSync(qmdPath, "utf8"));
      if (t) title = t;
    }
    const fromLast = last.slug === id ? last : {};
    const promptId =
      fromLast.promptId ||
      fromLast.styleId ||
      old.promptId ||
      old.styleId ||
      null;
    return {
      id,
      title,
      categoryId: fromLast.categoryId || old.categoryId || null,
      promptId,
      topicId: fromLast.topicId || old.topicId || null,
      qmd: fs.existsSync(qmdPath) ? `drafts/${id}.qmd` : null,
      md: fs.existsSync(mdPath) ? `published/${id}.md` : null,
      updatedAt: focus === id ? now : old.updatedAt || now,
    };
  });

  if (focus && !articles.find((a) => a.id === focus)) {
    articles.push({
      id: focus,
      title: focus,
      categoryId: last.categoryId || null,
      promptId: last.promptId || last.styleId || null,
      topicId: last.topicId || null,
      qmd: `drafts/${focus}.qmd`,
      md: null,
      updatedAt: now,
    });
  }

  articles.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const out = { articles, updatedAt: now };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`更新 index：${articles.length} 篇 → ${indexPath}`);

  const markSlug = focus || last.slug;
  if (markSlug && last.slug === markSlug && last.topicId) {
    markTopicDone(markSlug, last.topicId);
  }
}

main();
