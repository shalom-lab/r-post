#!/usr/bin/env node
/** RPost CLI：选题、撰写、查看。 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, "..");

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(scriptsDir, script), ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
}

function topics() {
  const file = path.join(root, "topics", "index.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).items || [] : [];
}

function list() {
  const rows = topics();
  console.log(`候选选题：${rows.filter((row) => !row.articleId).length}，已撰写：${rows.filter((row) => row.articleId).length}`);
  for (const row of rows) {
    console.log(`${row.articleId ? "✓" : "·"} [${row.id}] ${row.title}${row.articleId ? ` → ${row.articleId}` : ""}`);
  }
}

const [, , command, ...args] = process.argv;
switch (command) {
  case "topic":
  case "ideate":
    run("topic-generate.mjs", ["--mode", "ideate", ...args]);
    break;
  case "outline":
    run("topic-generate.mjs", ["--mode", "outline", ...args]);
    break;
  case "post":
  case "write":
    run("post-generate.mjs", args);
    break;
  case "list":
  case "status":
    list();
    break;
  default:
    console.log(`RPost

  topic [--quota N] [--categoryId ID] [--promptId ID]
  outline --topicId ID [--promptId ID]
  post (--topicId ID | --topic TEXT) [--promptId ID] [--slug SLUG]
  list
`);
}
