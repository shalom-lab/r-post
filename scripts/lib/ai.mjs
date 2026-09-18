import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "..");

export function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
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

export function stripFences(text) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json|qmd|quarto|markdown|md)?\s*\n?/i, "");
    t = t.replace(/\n?```\s*$/i, "");
  }
  return t.trim();
}

export function parseJsonLoose(text) {
  const t = stripFences(text);
  try {
    return JSON.parse(t);
  } catch {
    const startArr = t.indexOf("[");
    const startObj = t.indexOf("{");
    let start = -1;
    let end = -1;
    if (startArr >= 0 && (startObj < 0 || startArr < startObj)) {
      start = startArr;
      end = t.lastIndexOf("]");
    } else if (startObj >= 0) {
      start = startObj;
      end = t.lastIndexOf("}");
    }
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error("无法解析 JSON");
  }
}

export async function chatDeepSeek({ system, user, temperature = 0.5 }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少环境变量 DEEPSEEK_API_KEY");

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API 失败 ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("DeepSeek 返回空内容");
  return raw;
}

/**
 * @param {"topic"|"post"} kind
 * @param {string} [promptId]
 */
export function resolvePromptPath(kind, promptId) {
  const indexPath = path.join(root, "prompt-rules", "index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error("找不到 prompt-rules/index.json");
  }
  const idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const section = idx[kind];
  if (!section) throw new Error(`index.json 缺少 ${kind}`);
  const packs = section.packs || [];
  const id = promptId || section.defaultPromptId || packs[0]?.id;
  const pack = packs.find((p) => p.id === id && p.active !== false);
  if (!pack) throw new Error(`找不到 ${kind} 提示词: ${id}`);
  const file = pack.file || `${kind}_prompt_${id}.md`;
  const full = path.join(root, "prompt-rules", file);
  if (!fs.existsSync(full)) throw new Error(`文件不存在: ${full}`);
  return full;
}

/** @deprecated 用 resolvePromptPath("post", id) */
export function resolveStylePath(styleId) {
  return resolvePromptPath("post", styleId);
}
