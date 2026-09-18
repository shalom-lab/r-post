#!/usr/bin/env node
/**
 * 写作流水线（完整）：生成 QMD → 更新 content index → 标记选题成稿
 *
 * 注意：Quarto 渲染（QMD → MD）需要本地安装 Quarto，或在 GitHub Actions 中执行。
 * 本脚本负责：AI 生成 QMD + 图片内嵌（若 MD 已存在）+ 更新索引。
 * 在 CI 中，渲染步骤由 Actions workflow 单独完成。
 *
 * 用法：
 *   node scripts/post-generate.mjs --topicId topic-xxx
 *   node scripts/post-generate.mjs --scheduled          # 取排期第一条
 *   node scripts/post-generate.mjs --topic "用 ggplot2 画折线图" [--slug my-slug]
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY, TOPIC, SLUG, NOTE, PROMPT_ID, TOPIC_ID, CATEGORY_ID,
 *   FROM_SCHEDULED（"1"|"true"）
 */

import fs from "node:fs";
import path from "node:path";
import {
  chatDeepSeek,
  parseArgs,
  resolvePromptPath,
  root,
  stripFences,
} from "./lib/ai.mjs";

const topicsPath = path.join(root, "topics", "index.json");
const indexPath = path.join(root, "content", "index.json");
const draftsDir = path.join(root, "content", "drafts");
const publishedDir = path.join(root, "content", "published");
const lastGeneratePath = path.join(root, "content", ".last-generate.json");

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const ascii = base.replace(/[^\w-]+/g, "").replace(/^-+|-+$/g, "");
  if (ascii.length >= 2) return ascii;
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join("");
  return `r-post-${stamp}`;
}

function assertQmd(text) {
  if (!text.startsWith("---")) {
    throw new Error("生成结果缺少 YAML frontmatter（应以 --- 开头）");
  }
  const second = text.indexOf("---", 3);
  if (second < 0) throw new Error("生成结果 YAML frontmatter 未正确闭合");
}

// ─── QMD generation ───────────────────────────────────────────────────────────

async function generateQmd({ topic, slug, note, promptId, topicId, categoryId }) {
  let outlineNote = "";

  if (topicId) {
    const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const item = (store.items || []).find((i) => i.id === topicId);
    if (!item) throw new Error(`找不到选题 ${topicId}`);
    topic = topic || item.outline?.workingTitle || item.title;
    categoryId = categoryId || item.categoryId || "";
    if (item.outline) {
      outlineNote = `大纲 JSON：\n${JSON.stringify(item.outline, null, 2)}`;
    } else if (item.blurb) {
      outlineNote = `简介：${item.blurb}\n角度：${item.angle || ""}`;
    }
  }

  if (!topic) throw new Error("缺少 --topic / TOPIC，或有效的 --topicId");
  if (!slug) slug = slugify(topic);

  const rulesPath = resolvePromptPath("post", promptId || undefined);
  const rules = fs.readFileSync(rulesPath, "utf8");
  console.log(`[post-generate] prompt=${rulesPath}`);
  console.log(`[post-generate] topic="${topic}" slug="${slug}"`);

  const userParts = [
    `请按系统规则，就以下主题写一篇完整的 Quarto .qmd：`,
    ``,
    `主题：${topic}`,
  ];
  if (categoryId) userParts.push(`分类 id：${categoryId}`);
  if (outlineNote) userParts.push(``, outlineNote);
  if (note) userParts.push(``, `补充说明：${note}`);
  userParts.push(``, `今天日期：${new Date().toISOString().slice(0, 10)}`);

  const raw = await chatDeepSeek({
    system: rules,
    user: userParts.join("\n"),
    temperature: 0.4,
    stream: process.env.DEEPSEEK_STREAM === "1",
  });

  const qmd = stripFences(raw);
  assertQmd(qmd);

  fs.mkdirSync(draftsDir, { recursive: true });
  const outPath = path.join(draftsDir, `${slug}.qmd`);
  fs.writeFileSync(outPath, qmd.endsWith("\n") ? qmd : `${qmd}\n`, "utf8");
  console.log(`[post-generate] ✓ QMD → ${outPath}`);

  return { slug, topic, promptId: promptId || null, topicId: topicId || null, categoryId: categoryId || null };
}

// ─── Index update ─────────────────────────────────────────────────────────────

function titleFromQmd(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const ym = m[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return ym ? ym[1].trim() : null;
}

function updateIndex(meta) {
  const { slug, topicId, categoryId, promptId } = meta;

  // Load existing index
  const prev = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
    : { articles: [] };
  const byId = new Map((prev.articles || []).map((a) => [a.id, a]));

  // Collect all known slugs
  const slugSet = new Set();
  if (fs.existsSync(draftsDir)) {
    for (const f of fs.readdirSync(draftsDir)) {
      if (f.endsWith(".qmd")) slugSet.add(f.replace(/\.qmd$/, ""));
    }
  }
  if (fs.existsSync(publishedDir)) {
    for (const f of fs.readdirSync(publishedDir)) {
      if (f.endsWith(".md")) slugSet.add(f.replace(/\.md$/, ""));
    }
  }

  const now = new Date().toISOString();
  const articles = [...slugSet].map((id) => {
    const qmdPath = path.join(draftsDir, `${id}.qmd`);
    const mdPath = path.join(publishedDir, `${id}.md`);
    const old = byId.get(id) || {};
    let title = old.title || id;
    if (fs.existsSync(qmdPath)) {
      const t = titleFromQmd(fs.readFileSync(qmdPath, "utf8"));
      if (t) title = t;
    }
    const isNew = id === slug;
    return {
      id,
      title,
      categoryId: isNew ? categoryId || old.categoryId || null : old.categoryId || null,
      promptId: isNew ? promptId || old.promptId || null : old.promptId || null,
      topicId: isNew ? topicId || old.topicId || null : old.topicId || null,
      qmd: fs.existsSync(qmdPath) ? `drafts/${id}.qmd` : null,
      md: fs.existsSync(mdPath) ? `published/${id}.md` : null,
      updatedAt: isNew ? now : old.updatedAt || now,
    };
  });

  articles.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const out = { articles, updatedAt: now };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`[post-generate] ✓ index → ${articles.length} 篇`);

  // Mark topic as done
  if (slug && topicId && fs.existsSync(topicsPath)) {
    const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const item = (store.items || []).find((i) => i.id === topicId);
    if (item) {
      item.articleId = slug;
      item.scheduled = false;
      item.updatedAt = now;
      store.updatedAt = now;
      fs.writeFileSync(topicsPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      console.log(`[post-generate] ✓ 选题成稿标记: ${topicId} → ${slug}`);
    }
  }
}

// ─── Image embedding ──────────────────────────────────────────────────────────

function embedImages(mdPath) {
  if (!fs.existsSync(mdPath)) return;

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

  const dir = path.dirname(path.resolve(mdPath));
  let md = fs.readFileSync(mdPath, "utf8");
  md = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, src) => {
    const clean = src.trim().replace(/^<|>$/g, "").split(/\s+/)[0];
    if (/^(https?:|data:)/i.test(clean)) return full;
    const imgPath = path.resolve(dir, clean);
    if (!fs.existsSync(imgPath)) {
      console.warn(`[post-generate] 跳过缺失图片: ${clean}`);
      return full;
    }
    const buf = fs.readFileSync(imgPath);
    return `![${alt}](data:${mimeOf(imgPath)};base64,${buf.toString("base64")})`;
  });
  fs.writeFileSync(mdPath, md, "utf8");
  console.log(`[post-generate] ✓ 图片内嵌: ${mdPath}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  let topicId = (args.topicId || process.env.TOPIC_ID || "").trim();
  const fromScheduled =
    args.scheduled !== undefined ||
    process.env.FROM_SCHEDULED === "1" ||
    process.env.FROM_SCHEDULED === "true";

  // 从排期队列取下一条
  if (!topicId && fromScheduled) {
    if (!fs.existsSync(topicsPath)) throw new Error("topics/index.json 不存在");
    const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const next = (store.items || []).find((i) => i.scheduled && !i.articleId);
    if (!next) throw new Error("没有已排期且未成稿的选题");
    topicId = next.id;
    console.log(`[post-generate] 按排期取题: ${topicId} — ${next.title}`);
  }

  const meta = await generateQmd({
    topic: (args.topic || process.env.TOPIC || "").trim(),
    slug: (args.slug || process.env.SLUG || "").trim(),
    note: (args.note || process.env.NOTE || "").trim(),
    promptId: (args.promptId || process.env.PROMPT_ID || "").trim(),
    topicId,
    categoryId: (args.categoryId || process.env.CATEGORY_ID || "").trim(),
  });

  // 保存 .last-generate.json 供 CI 读取 slug
  fs.writeFileSync(
    lastGeneratePath,
    JSON.stringify(meta, null, 2) + "\n",
    "utf8",
  );

  // 如果 MD 已存在（本地 Quarto 已渲染），内嵌图片
  const mdPath = path.join(publishedDir, `${meta.slug}.md`);
  embedImages(mdPath);

  // 更新 content/index.json
  updateIndex(meta);

  // 输出 slug 给 GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${meta.slug}\n`);
  }

  console.log(`[post-generate] ✓ 完成 slug=${meta.slug}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
