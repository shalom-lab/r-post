#!/usr/bin/env node
/**
 * RPost 统一 CLI 入口
 *
 * 用法：
 *   node scripts/rpost.mjs <command> [options]
 *
 * 命令：
 *   ideate    [--quota N] [--categoryId x] [--promptId x]   AI 生成选题+大纲
 *   outline   [--topicId x | --scheduled] [--promptId x]    为选题补大纲
 *   write     [--topicId x | --scheduled] [--slug x]        AI 生成 QMD + 更新索引
 *   run       [--quota N]                                    全流水线（ideate→补大纲→write）
 *   status                                                   查看选题/稿件进度
 *   list      [--filter open|scheduled|done|all]            列出选题
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const topicsPath = path.join(root, "topics", "index.json");
const indexPath = path.join(root, "content", "index.json");

// ─── helpers ──────────────────────────────────────────────────────────────────

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function runScript(script, extraArgs = []) {
  const result = spawnSync(
    "node",
    [path.join(__dirname, script), ...extraArgs],
    {
      stdio: "inherit",
      env: process.env,
      cwd: root,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hr() {
  console.log("─".repeat(56));
}

// ─── commands ─────────────────────────────────────────────────────────────────

function cmdStatus() {
  const store = loadJson(topicsPath, { items: [] });
  const items = store.items || [];
  const open = items.filter((i) => !i.scheduled && !i.articleId).length;
  const scheduled = items.filter((i) => i.scheduled && !i.articleId).length;
  const done = items.filter((i) => i.articleId).length;

  const idx = loadJson(indexPath, { articles: [] });
  const articles = idx.articles || [];
  const withMd = articles.filter((a) => a.md).length;

  hr();
  console.log("📊 RPost 工作流状态");
  hr();
  console.log(`  选题总计  ${items.length} 条`);
  console.log(`  ⬜ 待办    ${open} 条`);
  console.log(`  🔵 已排期  ${scheduled} 条`);
  console.log(`  ✅ 成稿    ${done} 条`);
  hr();
  console.log(`  稿件总计  ${articles.length} 篇（含 MD 渲染: ${withMd} 篇）`);
  if (store.meta?.lastIdeatedAt) {
    console.log(`  上次选题  ${store.meta.lastIdeatedAt.slice(0, 16)}`);
  }
  hr();

  if (scheduled > 0) {
    console.log("  排期队列（前 5 条）：");
    items
      .filter((i) => i.scheduled && !i.articleId)
      .slice(0, 5)
      .forEach((i, n) => {
        const hasOutline = i.outline ? "📝" : "  ";
        console.log(`    ${n + 1}. ${hasOutline} ${i.title}`);
      });
    hr();
  }
}

function cmdList(args) {
  const filter = (args.filter || "all").toLowerCase();
  const store = loadJson(topicsPath, { items: [] });
  let items = store.items || [];

  if (filter === "open") items = items.filter((i) => !i.scheduled && !i.articleId);
  else if (filter === "scheduled") items = items.filter((i) => i.scheduled && !i.articleId);
  else if (filter === "done") items = items.filter((i) => i.articleId);

  hr();
  console.log(`📋 选题列表 [${filter}]（共 ${items.length} 条）`);
  hr();
  for (const item of items) {
    const status = item.articleId ? "✅" : item.scheduled ? "🔵" : "⬜";
    const outline = item.outline ? " 📝" : "";
    console.log(`  ${status}${outline} [${item.id}] ${item.title}`);
    if (item.blurb) console.log(`       ${item.blurb}`);
  }
  hr();
}

async function cmdRun(args) {
  const store = loadJson(topicsPath, {
    meta: { dailyQuota: 5, minScheduled: 2, autoWriteOnRun: true },
    items: [],
  });
  const meta = store.meta || {};
  const minScheduled = Number(meta.minScheduled ?? 2);
  const autoWrite = meta.autoWriteOnRun !== false;

  const scheduled = (store.items || []).filter(
    (i) => i.scheduled && !i.articleId,
  ).length;

  hr();
  console.log("🚀 rpost run — 全自动流水线");
  hr();

  // Step 1: 补充选题（如排期不足）
  if (scheduled < minScheduled) {
    console.log(
      `\n[run] 排期 ${scheduled} 条 < 阈值 ${minScheduled}，触发 ideate…`,
    );
    const quota = args.quota || String(meta.dailyQuota || 5);
    runScript("topic-generate.mjs", ["--mode", "ideate", "--quota", quota]);
  } else {
    console.log(`[run] 排期 ${scheduled} 条，无需补充选题`);
  }

  // Step 2: 补大纲（给排期中无大纲的条目）
  const storeAfter = loadJson(topicsPath, { items: [] });
  const needOutline = (storeAfter.items || []).filter(
    (i) => i.scheduled && !i.articleId && !i.outline,
  ).length;
  if (needOutline > 0) {
    console.log(`\n[run] ${needOutline} 条排期缺大纲，触发 outline…`);
    runScript("topic-generate.mjs", ["--mode", "outline", "--scheduled"]);
  }

  // Step 3: 写作
  if (autoWrite) {
    const storeNow = loadJson(topicsPath, { items: [] });
    const hasScheduled = (storeNow.items || []).some(
      (i) => i.scheduled && !i.articleId,
    );
    if (hasScheduled) {
      console.log("\n[run] 触发 post-generate（排期第一条）…");
      runScript("post-generate.mjs", ["--scheduled"]);
    } else {
      console.log("[run] 没有可写作的排期选题");
    }
  }

  console.log("\n[run] ✓ 流水线完成");
  cmdStatus();
}

// ─── main ─────────────────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;
const args = parseArgs(rest);

const HELP = `
RPost CLI — R 语言推文生成工作流

用法: node scripts/rpost.mjs <command> [options]

命令:
  ideate    AI 生成选题+大纲
            --quota N          生成条数（默认 5）
            --categoryId x     指定分类
            --promptId x       选题 Prompt id

  outline   为选题补大纲
            --topicId x        指定选题 id
            --scheduled        为所有排期中无大纲的选题补

  write     AI 写作 → 生成 QMD + 更新索引
            --topicId x        指定选题 id
            --scheduled        取排期第一条
            --slug x           自定义文件名

  run       全自动流水线（ideate → outline → write）
            --quota N          ideate 条数

  status    查看当前进度（选题数 / 排期 / 成稿）
  list      列出选题
            --filter open|scheduled|done|all
`;

switch (command) {
  case "ideate":
    runScript("topic-generate.mjs", ["--mode", "ideate", ...rest]);
    break;
  case "outline":
    runScript("topic-generate.mjs", ["--mode", "outline", ...rest]);
    break;
  case "write":
    runScript("post-generate.mjs", rest);
    break;
  case "run":
    await cmdRun(args);
    break;
  case "status":
    cmdStatus();
    break;
  case "list":
    cmdList(args);
    break;
  case undefined:
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  default:
    console.error(`未知命令: ${command}\n`);
    console.log(HELP);
    process.exit(1);
}
