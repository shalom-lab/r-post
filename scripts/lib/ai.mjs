import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "..", "..");

// ─── CLI args ────────────────────────────────────────────────────────────────

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

// ─── Text helpers ─────────────────────────────────────────────────────────────

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

// ─── DeepSeek API ─────────────────────────────────────────────────────────────

const DEEPSEEK_BASE = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 调用 DeepSeek chat completions（非流式，带重试）
 *
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.user
 * @param {number} [opts.temperature]
 * @param {string} [opts.model]   - deepseek-chat | deepseek-reasoner
 * @param {boolean} [opts.stream] - 是否流式输出到 stderr（仍返回完整字符串）
 * @returns {Promise<string>}
 */
export async function chatDeepSeek({
  system,
  user,
  temperature = 0.5,
  model,
  stream = false,
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少环境变量 DEEPSEEK_API_KEY");

  const useModel = model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  const useStream = stream || process.env.DEEPSEEK_STREAM === "1";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (useStream) {
        return await _chatStream(apiKey, useModel, system, user, temperature);
      } else {
        return await _chatSync(apiKey, useModel, system, user, temperature);
      }
    } catch (err) {
      const isLast = attempt === MAX_RETRIES;
      if (isLast) throw err;
      console.error(
        `[DeepSeek] 第 ${attempt} 次失败（${err.message}），${RETRY_DELAY_MS / 1000}s 后重试…`,
      );
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

async function _chatSync(apiKey, model, system, user, temperature) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("DeepSeek 返回空内容");
  return raw;
}

async function _chatStream(apiKey, model, system, user, temperature) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          process.stderr.write(delta);
          fullText += delta;
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
  process.stderr.write("\n");
  return fullText;
}

// ─── Prompt resolver ──────────────────────────────────────────────────────────

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
