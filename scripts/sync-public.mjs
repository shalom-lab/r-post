#!/usr/bin/env node
/** 同步只读文章内容 → apps/console/public/content/ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pub = path.join(root, "apps", "console", "public");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const src = path.join(root, "content");
const dest = path.join(pub, "content");
fs.rmSync(dest, { recursive: true, force: true });
if (fs.existsSync(src)) copyDir(src, dest);

// 选题页只公开一个 Markdown 源文件。
const topicsDest = path.join(pub, "topics");
fs.rmSync(topicsDest, { recursive: true, force: true });
fs.mkdirSync(topicsDest, { recursive: true });
fs.copyFileSync(path.join(root, "topics", "index.md"), path.join(topicsDest, "index.md"));

// 清理旧管理台静态数据
fs.rmSync(path.join(pub, "rules"), { recursive: true, force: true });
fs.rmSync(path.join(pub, "prompt-rules"), { recursive: true, force: true });
console.log("已同步 content/ 与 topics/index.md → apps/console/public/");
