#!/usr/bin/env node
/** 只把本流水线 draft/add 成功的稿记入 wechat_draft.json，不列举公众号后台手建草稿。 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { getWeChatHtml } from "markmuse-wechat/converter";
import { bodyMarkdown } from "./lib/wechat-body-markdown.mjs";
import {
  appendDraft,
  chunkIssues,
  normalizeDraftLog,
  normalizeQueue,
  removeItems,
  serializeDraftLog,
  serializeQueue,
} from "./lib/wechat-queue.mjs";
import { DEFAULT_THEME, loadThemeCss } from "./lib/wechat-theme-css.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queuePath = path.join(root, "wechat", "queue.json");
const draftLogPath = path.join(root, "wechat", "wechat_draft.json");
const indexPath = path.join(root, "content", "index.json");
const mdcssDir = path.join(root, "mdcss");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const cut = text.indexOf("=");
    if (cut < 0) continue;
    const key = text.slice(0, cut).trim();
    let value = text.slice(cut + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function solidPng(width, height, r, g, b) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function mimeToExt(mime) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return { ext: "jpg", mime: "image/jpeg" };
  if (mime.includes("gif")) return { ext: "gif", mime: "image/gif" };
  if (mime.includes("webp")) return { ext: "webp", mime: "image/webp" };
  if (mime.includes("bmp")) return { ext: "bmp", mime: "image/bmp" };
  return { ext: "png", mime: "image/png" };
}

async function wechatJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`微信接口返回无法解析（${response.status}）`);
  }
  if (data.errcode) throw new Error(`微信接口错误 ${data.errcode}: ${data.errmsg || ""}`);
  return data;
}

/** 中控约定：GET 读缓存；expired 再 POST 强制刷新。鉴权头 X-Api-Key。 */
async function accessToken(baseUrl, apiKey, appName) {
  const headers = { "X-Api-Key": apiKey };
  const endpoint = `${baseUrl.replace(/\/$/, "")}/access_token/${encodeURIComponent(appName)}`;
  let data = await fetch(endpoint, { headers }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `读取 access_token 失败（${response.status}）`);
    return body;
  });
  if (data.expired) {
    const refreshed = await fetch(endpoint, { method: "POST", headers });
    data = await refreshed.json().catch(() => ({}));
    if (!refreshed.ok) throw new Error(data.error || `刷新 access_token 失败（${refreshed.status}）`);
  }
  if (!data.access_token || data.expired) throw new Error("中控没有给出可用的 access_token。");
  return data.access_token;
}

function loadPublishConfig() {
  loadEnvFile(path.join(root, "wechat", ".env"));
  const file = path.join(root, "wechat", "config.json");
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  return {
    tokenUrl: String(process.env.WECHAT_TOKEN_URL || "").trim(),
    appName: String(process.env.WECHAT_APP_NAME || raw.appName || "").trim(),
    author: String(raw.author || "").trim(),
    articlesPerDraft: Math.min(2, Math.max(1, Number(raw.articlesPerDraft) || 2)),
    theme: String(raw.theme || DEFAULT_THEME).trim() || DEFAULT_THEME,
    apiKey: String(process.env.WECHAT_API_KEY || "").trim(),
  };
}

async function decodeSrc(src, mdDir) {
  const value = src.trim();
  const dataUri = value.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/i);
  if (dataUri) {
    const kind = mimeToExt(dataUri[1].toLowerCase());
    return { buffer: Buffer.from(dataUri[2], "base64"), ...kind };
  }
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) throw new Error(`下载图片失败 ${response.status}: ${value}`);
    const mime = (response.headers.get("content-type") || "image/png").split(";")[0];
    const kind = mimeToExt(mime.toLowerCase());
    return { buffer: Buffer.from(await response.arrayBuffer()), ...kind };
  }
  const local = path.resolve(mdDir, value);
  if (!fs.existsSync(local)) throw new Error(`找不到图片 ${value}`);
  const kind = mimeToExt(path.extname(local).toLowerCase());
  return { buffer: fs.readFileSync(local), ...kind };
}

async function uploadForm(url, buffer, filename, mime) {
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  return wechatJson(url, { method: "POST", body: form });
}

async function replaceImages(html, mdDir, token) {
  const pattern = /(<img\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi;
  const found = [...html.matchAll(pattern)].map((match) => match[3]);
  const unique = [...new Set(found)];
  const mapped = new Map();
  let cover = null;
  for (const src of unique) {
    if (src.startsWith("http://mmbiz.qpic.cn") || src.startsWith("https://mmbiz.qpic.cn")) {
      mapped.set(src, src);
      continue;
    }
    const image = await decodeSrc(src, mdDir);
    if (image.ext === "svg") throw new Error("微信草稿不接受 SVG 图片，请先转成 PNG/JPG。");
    const uploaded = await uploadForm(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${token}`,
      image.buffer,
      `image.${image.ext}`,
      image.mime,
    );
    if (!uploaded.url) throw new Error("上传正文图片后没有返回 url。");
    mapped.set(src, uploaded.url);
    if (!cover) cover = image;
  }
  const next = html.replace(pattern, (full, prefix, quote, src) => `${prefix}${quote}${mapped.get(src) || src}${quote}`);
  return { html: next, cover };
}

async function uploadCover(token, cover) {
  const image = cover || {
    buffer: solidPng(900, 500, 36, 95, 74),
    ext: "png",
    mime: "image/png",
  };
  const uploaded = await uploadForm(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`,
    image.buffer,
    `cover.${image.ext}`,
    image.mime,
  );
  if (!uploaded.media_id) throw new Error("上传封面后没有返回 media_id。");
  return uploaded.media_id;
}

async function convertArticle(article, customCss) {
  if (!article.md) throw new Error(`${article.id} 还没有渲染出 Markdown，不能上传草稿。`);
  const mdPath = path.join(root, "content", article.md);
  if (!fs.existsSync(mdPath)) throw new Error(`找不到 ${article.md}`);
  const markdown = bodyMarkdown(fs.readFileSync(mdPath, "utf8"));
  // Node 侧 getWeChatHtml 内部走 convertDefault(markdown, customCss)，会与默认样式合并
  const html = await getWeChatHtml(markdown, customCss);
  return { html, mdDir: path.dirname(mdPath) };
}

async function main() {
  const { tokenUrl, apiKey, appName, author, articlesPerDraft, theme } = loadPublishConfig();
  if (!apiKey) throw new Error("请设置 WECHAT_API_KEY（wechat/.env 或 Actions secret），不要写进仓库。");
  if (!tokenUrl) throw new Error("请设置 WECHAT_TOKEN_URL（wechat/.env 或 Actions secret），不要写进仓库。");
  if (!appName) throw new Error("请在 wechat/config.json 填写 appName（中控 apps.json 里的 name）。");

  let queue = normalizeQueue(JSON.parse(fs.readFileSync(queuePath, "utf8")));
  let draftLog = normalizeDraftLog(
    fs.existsSync(draftLogPath) ? JSON.parse(fs.readFileSync(draftLogPath, "utf8")) : {},
  );
  if (!queue.items.length) {
    console.log("没有待上传的公众号排期。");
    return;
  }

  const customCss = loadThemeCss(mdcssDir, theme);
  const catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const token = await accessToken(tokenUrl, apiKey, appName);
  const issues = chunkIssues(queue.items, articlesPerDraft);

  for (const issue of issues) {
    const articles = issue.map((item) => {
      const article = (catalog.articles || []).find((row) => row.id === item.id);
      if (!article) throw new Error(`排期里的 ${item.id} 不在 content/index.json`);
      return article;
    });
    const ids = articles.map((article) => article.id);
    const news = [];
    for (const article of articles) {
      const converted = await convertArticle(article, customCss);
      const withImages = await replaceImages(converted.html, converted.mdDir, token);
      news.push({
        article_type: "news",
        title: article.title.slice(0, 64),
        author,
        digest: (article.description || article.title).slice(0, 120),
        content: withImages.html,
        content_source_url: "",
        thumb_media_id: await uploadCover(token, withImages.cover),
        need_open_comment: 0,
        only_fans_can_comment: 0,
      });
    }
    const created = await wechatJson(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: news }),
      },
    );
    if (!created.media_id) throw new Error("新建草稿后没有返回 media_id。");
    draftLog = appendDraft(draftLog, {
      mediaId: created.media_id,
      ids,
      titles: articles.map((article) => article.title),
    });
    queue = removeItems(queue, ids);
    fs.writeFileSync(draftLogPath, serializeDraftLog(draftLog), "utf8");
    fs.writeFileSync(queuePath, serializeQueue(queue), "utf8");
    console.log(`已上传一期草稿（${ids.join("、")}）→ ${created.media_id}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
