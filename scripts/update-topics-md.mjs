#!/usr/bin/env node
/** Render the structured topic store as a human-readable Markdown page. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "topics", "index.json");
const mdPath = path.join(root, "topics", "index.md");

export function renderTopicsMarkdown() {
  const store = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const lines = [
    "# RPost 候选选题",
    "",
    "> 选题数据由 topics/index.json 管理；本页自动生成，用于阅读。",
    "",
  ];
  for (const [index, item] of (store.items || []).entries()) {
    const number = String(index + 1).padStart(3, "0");
    const article = item.article && typeof item.article === "object" ? item.article : null;
    const rendered = article?.md && fs.existsSync(path.join(root, article.md));
    const articleLink = rendered ? article.md : article?.qmd;
    lines.push(
      "## " + number + ". " + item.title,
      "",
      "- 状态：" + (article ? "已成稿" : "候选"),
      "- 分类：" + (item.categoryId || "未分类"),
      "- 成稿：" + (articleLink ? "[" + (article.title || item.title) + "](../" + articleLink + ")" : ""),
      "- 创建：" + String(item.createdAt || "").slice(0, 10),
      "- 示例数据：" + (item.outline?.dataset || "待补充"),
      "",
      "### 选题说明",
      "",
      item.blurb || "",
      "",
      "### 内容大纲",
      "",
    );
    for (const [sectionIndex, section] of (item.outline?.sections || []).entries()) {
      lines.push((sectionIndex + 1) + ". **" + section.heading + "**：" + section.point);
    }
    if (item.outline?.takeaway) {
      lines.push("", "### 读者带走", "", item.outline.takeaway);
    }
    lines.push("");
  }
  fs.writeFileSync(mdPath, lines.join("\n").trimEnd() + "\n", "utf8");
  console.log("更新选题视图：" + (store.items || []).length + " 条 → " + mdPath);
}

renderTopicsMarkdown();
