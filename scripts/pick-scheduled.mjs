#!/usr/bin/env node
/**
 * 从 topics 中按列表顺序取下一条「已排期」选题，写入 GITHUB_OUTPUT / .last-pick.json
 * 若指定 --topicId 则用该条。
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs, root } from "./lib/ai.mjs";

const topicsPath = path.join(root, "topics", "index.json");
const outPath = path.join(root, "content", ".last-pick.json");

function main() {
  const args = parseArgs(process.argv);
  const topicId = (args.topicId || process.env.TOPIC_ID || "").trim();
  const fromScheduled =
    args.scheduled !== undefined ||
    process.env.FROM_SCHEDULED === "1" ||
    process.env.FROM_SCHEDULED === "true";

  const store = JSON.parse(fs.readFileSync(topicsPath, "utf8"));
  let item = null;

  if (topicId) {
    item = (store.items || []).find((i) => i.id === topicId) || null;
    if (!item) throw new Error(`找不到选题 ${topicId}`);
  } else if (fromScheduled) {
    item = (store.items || []).find((i) => i.scheduled && !i.articleId) || null;
    if (!item) throw new Error("没有已排期且未成稿的选题");
  } else {
    throw new Error("需要 --topicId 或 --scheduled");
  }

  const pick = {
    topicId: item.id,
    topic: item.outline?.workingTitle || item.title,
    categoryId: item.categoryId || null,
    blurb: item.blurb || "",
    hasOutline: Boolean(item.outline),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(pick, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(pick));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `topicId=${pick.topicId}\ntopic=${pick.topic.replace(/\n/g, " ")}\ncategoryId=${pick.categoryId || ""}\n`,
    );
  }
}

main();
