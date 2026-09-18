#!/usr/bin/env node
/** 同步 content/、prompt-rules/、topics/ → apps/console/public/ */
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

for (const name of ["content", "prompt-rules", "topics"]) {
  const src = path.join(root, name);
  const dest = path.join(pub, name);
  fs.rmSync(dest, { recursive: true, force: true });
  if (fs.existsSync(src)) copyDir(src, dest);
}
// 清理旧 public/rules
fs.rmSync(path.join(pub, "rules"), { recursive: true, force: true });
console.log("已同步 content/、prompt-rules/、topics/ → apps/console/public/");
