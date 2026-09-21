#!/usr/bin/env node
/** Generate one QMD in content/posts/NNN-slug from a topic id or free topic. */
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
const postsDir = path.join(root, "content", "posts");
const lastGeneratePath = path.join(root, "content", ".last-generate.json");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function nextNumber() {
  if (!fs.existsSync(postsDir)) return "001";
  const ids = fs.readdirSync(postsDir)
    .map((name) => Number(name.match(/^(\d+)/)?.[1]))
    .filter(Number.isFinite);
  return String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, "0");
}

function safeSlug(value, id) {
  const slug = String(value || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "r-post-" + id;
}

function safeFileTitle(value) {
  return String(value).replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "").slice(0, 70) || "R语言短教程";
}

function qmdTitle(text, fallback) {
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---/);
  return frontmatter?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1].trim() || fallback;
}

function assertQmd(text) {
  if (!/^---\s*\n[\s\S]+?\n---/.test(text)) throw new Error("生成结果缺少完整 YAML frontmatter");
  if (!text.includes("```{r}")) throw new Error("生成结果没有可执行 R 代码块");
}

function addMetadata(qmd, category, description) {
  const close = qmd.indexOf("\n---", 3);
  if (close < 0) return qmd;
  const yaml = qmd.slice(0, close);
  const quote = (value) => '"' + String(value).replace(/"/g, '\\"') + '"';
  const additions = [];
  if (!/^description:/m.test(yaml)) additions.push("description: " + quote(description));
  if (!/^category:/m.test(yaml)) additions.push("category: " + quote(category || "R语言"));
  if (!/^tags:/m.test(yaml)) additions.push("tags: [R语言, 教程]");
  return additions.length ? yaml + "\n" + additions.join("\n") + qmd.slice(close) : qmd;
}

async function main() {
  const args = parseArgs(process.argv);
  const topicId = String(args.topicId || process.env.TOPIC_ID || "").trim();
  let topic = String(args.topic || process.env.TOPIC || "").trim();
  let category = String(args.categoryId || process.env.CATEGORY_ID || "").trim();
  let selected = null;
  let store = null;
  if (topicId) {
    store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
    const numericIndex = /^\d+$/.test(topicId) ? Number(topicId) - 1 : -1;
    selected = (store.items || []).find((item) => item.id === topicId) || store.items?.[numericIndex];
    if (!selected) throw new Error("找不到选题 " + topicId);
    topic = topic || selected.outline?.workingTitle || selected.title;
    category = category || selected.categoryId || "";
  }
  if (!topic) throw new Error("请提供 topicId 或自由主题 topic");

  const articleId = nextNumber();
  const slug = safeSlug(args.slug || process.env.SLUG, articleId);
  const note = String(args.note || process.env.NOTE || "").trim();
  const promptId = String(args.promptId || process.env.PROMPT_ID || "").trim();
  const rules = fs.readFileSync(resolvePromptPath("post", promptId || undefined), "utf8");
  const user = [
    "请按系统规则生成一篇完整的 Quarto QMD，只输出 QMD 原文。",
    "主题：" + topic,
    category ? "分类：" + category : "",
    selected ? "候选选题与大纲：\n" + JSON.stringify(selected, null, 2) : "",
    note ? "补充要求：" + note : "",
    "今天日期：" + new Date().toISOString().slice(0, 10),
  ].filter(Boolean).join("\n\n");
  let qmd = stripFences(await chatDeepSeek({
    system: rules,
    user,
    temperature: 0.4,
    stream: process.env.DEEPSEEK_STREAM === "1",
  }));
  assertQmd(qmd);
  qmd = addMetadata(qmd, category, selected?.blurb || topic);
  const title = qmdTitle(qmd, topic);
  const folderName = articleId + "-" + slug;
  const filename = articleId + "-" + safeFileTitle(title) + ".qmd";
  const folder = path.join(postsDir, folderName);
  const qmdPath = path.join(folder, filename);
  const mdPath = qmdPath.replace(/\.qmd$/, ".md");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(qmdPath, qmd.endsWith("\n") ? qmd : qmd + "\n", "utf8");

  const qmdRelative = toPosix(path.relative(root, qmdPath));
  const mdRelative = toPosix(path.relative(root, mdPath));
  if (selected && store) {
    selected.article = { id: articleId, title, qmd: qmdRelative, md: mdRelative };
    selected.updatedAt = new Date().toISOString();
    store.updatedAt = selected.updatedAt;
    fs.writeFileSync(topicsPath, JSON.stringify(store, null, 2) + "\n", "utf8");
    await import("./update-topics-md.mjs");
  }
  const meta = { articleId, slug: folderName, title, qmd: qmdRelative, md: mdRelative };
  fs.writeFileSync(lastGeneratePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, "qmd=" + qmdRelative + "\nmd=" + mdRelative + "\nslug=" + folderName + "\n");
  }
  console.log("[post] 已生成 " + qmdRelative);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
