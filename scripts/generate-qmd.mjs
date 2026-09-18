#!/usr/bin/env node
/**
 * 读取风格 pack + topic（或选题大纲），调用 DeepSeek，写出 content/drafts/<slug>.qmd
 *
 *   node scripts/generate-qmd.mjs --topic "..." [--slug x] [--promptId wechat-short] [--topicId topic-xxx]
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
  return `r-lesson-${stamp}`;
}

function assertQmd(text) {
  if (!text.startsWith("---")) {
    throw new Error("生成结果缺少 YAML frontmatter（应以 --- 开头）");
  }
  const second = text.indexOf("---", 3);
  if (second < 0) throw new Error("生成结果 YAML frontmatter 未正确闭合");
}

async function main() {
  const args = parseArgs(process.argv);
  let topic = (args.topic || process.env.TOPIC || "").trim();
  const note = (args.note || process.env.NOTE || "").trim();
  let slug = (args.slug || process.env.SLUG || "").trim();
  const promptId = (
    args.promptId ||
    args.styleId ||
    process.env.PROMPT_ID ||
    process.env.STYLE_ID ||
    ""
  ).trim();
  let topicId = (args.topicId || process.env.TOPIC_ID || "").trim();
  let categoryId = (args.categoryId || process.env.CATEGORY_ID || "").trim();
  const fromScheduled =
    args.scheduled !== undefined ||
    process.env.FROM_SCHEDULED === "1" ||
    process.env.FROM_SCHEDULED === "true";
  let outlineNote = "";

  // 从已排期队列按列表顺序取下一条（尚未成稿）
  if (!topicId && fromScheduled) {
    const topicsPath = path.join(root, "topics", "index.json");
    const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const next = (store.items || []).find((i) => i.scheduled && !i.articleId);
    if (!next) throw new Error("没有已排期且未成稿的选题");
    topicId = next.id;
    console.log(`按排期取题: ${topicId} — ${next.title}`);
  }

  if (topicId) {
    const topicsPath = path.join(root, "topics", "index.json");
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

  if (!topic) {
    console.error("缺少 --topic / TOPIC，或有效的 --topicId");
    process.exit(1);
  }
  if (!slug) slug = slugify(topic);

  const rulesPath = resolvePromptPath("post", promptId || undefined);
  const rules = fs.readFileSync(rulesPath, "utf8");
  console.log(`使用写作 Prompt: ${rulesPath}`);

  const userParts = [
    `请按系统规则，就以下主题写一篇完整的 Quarto .qmd：`,
    ``,
    `主题：${topic}`,
  ];
  if (categoryId) userParts.push(`分类 id：${categoryId}`);
  if (outlineNote) userParts.push(``, outlineNote);
  if (note) userParts.push(``, `补充说明：${note}`);
  userParts.push(``, `今天日期：${new Date().toISOString().slice(0, 10)}`);

  console.log(`生成中… topic="${topic}" slug="${slug}"`);
  const raw = await chatDeepSeek({
    system: rules,
    user: userParts.join("\n"),
    temperature: 0.4,
  });

  const qmd = stripFences(raw);
  assertQmd(qmd);

  const draftsDir = path.join(root, "content", "drafts");
  fs.mkdirSync(draftsDir, { recursive: true });
  const outPath = path.join(draftsDir, `${slug}.qmd`);
  fs.writeFileSync(outPath, qmd.endsWith("\n") ? qmd : `${qmd}\n`, "utf8");

  const metaPath = path.join(root, "content", ".last-generate.json");
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        slug,
        topic,
        styleId: promptId || null,
        promptId: promptId || null,
        topicId: topicId || null,
        categoryId: categoryId || null,
        qmdPath: `content/drafts/${slug}.qmd`,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  if (topicId) {
    const topicsPath = path.join(root, "topics", "index.json");
    const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const item = (store.items || []).find((i) => i.id === topicId);
    if (item) {
      item.articleId = slug;
      item.scheduled = false;
      item.updatedAt = new Date().toISOString();
      store.updatedAt = item.updatedAt;
      fs.writeFileSync(topicsPath, JSON.stringify(store, null, 2) + "\n", "utf8");
    }
  }

  console.log(`已写入 ${outPath}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
