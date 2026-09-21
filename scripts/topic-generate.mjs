#!/usr/bin/env node
/** Generate structured topic candidates, then refresh topics/index.md. */
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

function classify(text) {
  if (/ggplot|作图|绘图|图表|可视化/i.test(text)) return "r-plot";
  if (/统计|回归|检验|相关|方差|概率|置信区间/i.test(text)) return "r-stats";
  if (/tidyverse|dplyr|tidyr|purrr|管道|数据整理/i.test(text)) return "r-tidyverse";
  if (/代码管理|项目|renv|git|包管理|目录结构|函数管理/i.test(text)) return "r-code-management";
  return "r-base";
}

function validate(rows, quota, categoryIds) {
  if (!Array.isArray(rows) || rows.length !== quota) {
    throw new Error("模型返回条数与 quota 不一致");
  }
  for (const [index, row] of rows.entries()) {
    if (!row?.title || !row?.blurb || !row?.outline || !Array.isArray(row.outline.sections)) {
      throw new Error("第 " + (index + 1) + " 条缺少 title、blurb 或 outline.sections");
    }
    if (row.outline.sections.length < 2) throw new Error("第 " + (index + 1) + " 条大纲过短");
    if (row.categoryId && !categoryIds.includes(row.categoryId)) {
      throw new Error("第 " + (index + 1) + " 条使用了未知分类 " + row.categoryId);
    }
  }
}

function newId() {
  return "topic-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

async function main() {
  const args = parseArgs(process.argv);
  const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
  const categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8")).categories || [];
  const categoryIds = categories.map((item) => item.id);
  const quota = Number(args.quota || process.env.QUOTA || store.meta?.dailyQuota || 5);
  if (!Number.isInteger(quota) || quota < 1 || quota > 20) {
    throw new Error("quota 必须是 1–20 的整数");
  }
  const promptId = String(args.promptId || process.env.PROMPT_ID || store.meta?.topicPromptId || "").trim();
  const categoryId = String(args.categoryId || process.env.CATEGORY_ID || "").trim();
  const rules = fs.readFileSync(resolvePromptPath("topic", promptId || undefined), "utf8");
  const titles = (store.items || []).map((item) => item.title).filter(Boolean);
  const user = [
    "请生成 " + quota + " 条候选选题，每条同时给出完整大纲。",
    categoryId ? "优先分类：" + categoryId : "",
    "请从下面的固定分类中自动选择最合适的一项：",
    categories.map((item) => "- " + item.id + ": " + item.name).join("\n"),
    "",
    "已有标题，不能重复：",
    titles.length ? titles.map((title) => "- " + title).join("\n") : "- 暂无",
    "",
    "只输出符合规则的 JSON 数组。",
  ].filter(Boolean).join("\n");
  const rows = parseJsonLoose(await chatDeepSeek({ system: rules, user, temperature: 0.75 }));
  validate(rows, quota, categoryIds);

  const now = new Date().toISOString();
  const added = rows.map((row) => ({
    id: newId(),
    title: String(row.title).trim(),
    blurb: String(row.blurb).trim(),
    categoryId: String(row.categoryId || categoryId || classify(row.title + " " + row.blurb)).trim(),
    angle: String(row.angle || "").trim() || null,
    outline: row.outline,
    article: null,
    createdAt: now,
    updatedAt: now,
  }));
  store.items = [...(store.items || []), ...added];
  store.meta = { ...store.meta, dailyQuota: quota, topicPromptId: promptId || "default", lastIdeatedAt: now };
  store.updatedAt = now;
  fs.writeFileSync(topicsPath, JSON.stringify(store, null, 2) + "\n", "utf8");
  await import("./update-topics-md.mjs");
  console.log("[topic] 已追加 " + added.length + " 条候选选题");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
