#!/usr/bin/env node
/**
 * 选题工作流：ideate（AI 生成候选选题+大纲）| outline（为已有选题补大纲）
 * 统一使用 prompt-rules/ 下的 topic_prompt_*.md。
 *
 * 用法：
 *   node scripts/topic-generate.mjs --mode ideate [--quota 5] [--promptId default] [--categoryId xxx]
 *   node scripts/topic-generate.mjs --mode outline [--topicId xxx | --scheduled] [--promptId default]
 *
 * 环境变量（GitHub Actions / CI 也支持）：
 *   DEEPSEEK_API_KEY, MODE, QUOTA, PROMPT_ID, CATEGORY_ID, TOPIC_ID, SCHEDULED
 */

import fs from "node:fs";
import path from "node:path";
import {
  chatDeepSeek,
  parseArgs,
  parseJsonLoose,
  resolvePromptPath,
  root,
} from "./lib/ai.mjs";

const topicsPath = path.join(root, "topics", "index.json");
const categoriesPath = path.join(root, "content", "categories.json");

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function newId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `topic-${t}-${r}`;
}

// ─── ideate ──────────────────────────────────────────────────────────────────

async function runIdeate(args, store, system) {
  const quota = Number(
    args.quota || process.env.QUOTA || store.meta?.dailyQuota || 5,
  );
  const categoryFilter = (
    args.categoryId ||
    process.env.CATEGORY_ID ||
    ""
  ).trim();
  const cats = loadJson(categoriesPath, { categories: [] }).categories || [];
  const catList = cats.map((c) => `- ${c.id}: ${c.name}`).join("\n");
  const existingTitles = (store.items || [])
    .map((i) => i.title)
    .filter(Boolean)
    .slice(0, 80);

  const user = [
    `模式：ideate`,
    `请生成 ${quota} 条选题。每条必须同时给出 outline（题目+大纲一次完成）。`,
    categoryFilter
      ? `优先分类 categoryId=${categoryFilter}（若合理）。`
      : "分类请从下列 id 中选择（也可空）：",
    catList || "- （无）",
    "",
    "已有选题标题（避免重复）：",
    existingTitles.length
      ? existingTitles.map((t) => `- ${t}`).join("\n")
      : "- （暂无）",
    "",
    "只输出 JSON 数组；每项含 title、blurb、categoryId、angle、outline。",
  ].join("\n");

  console.log(`[topic-generate] ideate … quota=${quota}`);
  const raw = await chatDeepSeek({ system, user, temperature: 0.8 });
  const arr = parseJsonLoose(raw);
  if (!Array.isArray(arr)) throw new Error("模型未返回 JSON 数组");

  const now = new Date().toISOString();
  const added = [];
  for (const row of arr.slice(0, quota)) {
    const title = String(row.title || "").trim();
    if (!title) continue;
    const outline =
      row.outline && typeof row.outline === "object" && !Array.isArray(row.outline)
        ? row.outline
        : null;
    added.push({
      id: newId(),
      title,
      blurb: String(row.blurb || "").trim(),
      categoryId: String(row.categoryId || categoryFilter || "").trim() || null,
      angle: String(row.angle || "").trim() || null,
      scheduled: false,
      outline,
      outlinedAt: outline ? now : null,
      articleId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const withOutline = added.filter((a) => a.outline).length;
  store.items = [...added, ...(store.items || [])];
  store.meta = {
    ...store.meta,
    dailyQuota: store.meta?.dailyQuota ?? 5,
    topicPromptId:
      args.promptId ||
      process.env.PROMPT_ID ||
      store.meta?.topicPromptId ||
      "default",
    lastIdeatedAt: now,
  };
  console.log(
    `[topic-generate] 追加 ${added.length} 条（其中 ${withOutline} 条已带大纲）`,
  );
}

// ─── outline ─────────────────────────────────────────────────────────────────

async function runOutline(args, store, system) {
  const cats = loadJson(categoriesPath, { categories: [] }).categories || [];
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  let targets = [];
  if (args.topicId || process.env.TOPIC_ID) {
    const id = (args.topicId || process.env.TOPIC_ID).trim();
    const item = (store.items || []).find((i) => i.id === id);
    if (!item) throw new Error(`找不到选题 ${id}`);
    targets = [item];
  } else if (
    args.scheduled !== undefined ||
    process.env.SCHEDULED === "1" ||
    process.env.ALL_SELECTED === "1"
  ) {
    targets = (store.items || []).filter((i) => i.scheduled && !i.outline);
  } else {
    throw new Error("outline 模式需要 --topicId 或 --scheduled");
  }

  if (!targets.length) {
    console.log("[topic-generate] 没有需要大纲的选题");
    return;
  }

  for (const item of targets) {
    const user = [
      `模式：outline`,
      `选题 id: ${item.id}`,
      `title: ${item.title}`,
      `blurb: ${item.blurb || ""}`,
      `category: ${catMap[item.categoryId] || item.categoryId || ""}`,
      `angle: ${item.angle || ""}`,
      "",
      "请输出大纲 JSON 对象。",
    ].join("\n");

    console.log(`[topic-generate] outline: ${item.id} — ${item.title}`);
    const raw = await chatDeepSeek({ system, user, temperature: 0.5 });
    const outline = parseJsonLoose(raw);
    if (!outline || typeof outline !== "object" || Array.isArray(outline)) {
      throw new Error(`大纲解析失败: ${item.id}`);
    }
    item.outline = outline;
    item.outlinedAt = new Date().toISOString();
    item.updatedAt = item.outlinedAt;
    console.log(
      `[topic-generate] ✓ ${item.id} → ${outline.workingTitle || item.title}`,
    );
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const mode = String(
    args.mode || process.env.MODE || "ideate",
  ).toLowerCase();
  if (mode !== "ideate" && mode !== "outline") {
    throw new Error(`未知 mode: ${mode}（ideate|outline）`);
  }

  const store = loadJson(topicsPath, {
    meta: { dailyQuota: 5, topicPromptId: "default" },
    items: [],
  });
  const promptId = (
    args.promptId ||
    process.env.PROMPT_ID ||
    store.meta?.topicPromptId ||
    ""
  ).trim();

  const promptPath = resolvePromptPath("topic", promptId || undefined);
  const system = fs.readFileSync(promptPath, "utf8");
  console.log(`[topic-generate] prompt=${promptPath} mode=${mode}`);

  if (mode === "ideate") await runIdeate(args, store, system);
  else await runOutline(args, store, system);

  store.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(topicsPath), { recursive: true });
  fs.writeFileSync(
    topicsPath,
    JSON.stringify(store, null, 2) + "\n",
    "utf8",
  );
  console.log(`[topic-generate] ✓ 已更新 ${topicsPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
