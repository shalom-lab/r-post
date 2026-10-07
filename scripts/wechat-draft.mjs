#!/usr/bin/env node
/** 只把本流水线 draft/add 成功的稿记入 wechat_draft.json，不列举公众号后台手建草稿。 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { getWeChatHtml } from "markmuse-wechat/converter";
import {
  appendDraft,
  chunkIssues,
  normalizeDraftLog,
  normalizeQueue,
  removeItems,
  serializeDraftLog,
  serializeQueue,
} from "./lib/wechat-queue.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queuePath = path.join(root, "wechat", "queue.json");
const draftLogPath = path.join(root, "wechat", "wechat_draft.json");
const indexPath = path.join(root, "content", "index.json");
const themeDir = path.join(root, "wechat", "custom-md-css");

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

function isFenceLine(line) {
  return /^```/.test(line);
}

function isBlockLine(line) {
  return /^(#{1,6}\s|>\s|[-*+]\s|\d+[.)]\s|\|.+\||-{3,}\s*$| {4,}|\t)/.test(line);
}

/** Quarto GFM 会按行宽折段落；markmuse 常把单个换行当成 <br>，行内代码就会被拆到下一行。 */
function unwrapSoftBreaks(markdown) {
  const lines = markdown.split(/\n/);
  const out = [];
  let inFence = false;
  let para = [];
  const flush = () => {
    if (!para.length) return;
    out.push(para.join(" "));
    para = [];
  };
  for (const line of lines) {
    if (isFenceLine(line)) {
      flush();
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence || !line.trim() || isBlockLine(line)) {
      flush();
      out.push(line);
      continue;
    }
    para.push(line.replace(/\s+$/, ""));
  }
  flush();
  return out.join("\n");
}

function bodyMarkdown(markdown) {
  let text = markdown.replace(/^\uFEFF/, "").replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  text = text.replace(/^#\s+[^\n]+\n+/, "");
  // Quarto GFM 会在标题下写出 author / date 两行。微信草稿已有作者和发布时间，正文里留着会叠两套。
  text = text.replace(/^RPost\s*\n/, "");
  text = text.replace(/^\d{4}-\d{2}-\d{2}\s*\n+/, "");
  return `${unwrapSoftBreaks(text).trim()}\n`;
}

function appendInlineStyle(attrs, extra) {
  if (/\bstyle\s*=/i.test(attrs)) {
    return attrs.replace(/\bstyle=(["'])([\s\S]*?)\1/i, (_, quote, css) => `style=${quote}${css};${extra}${quote}`);
  }
  return `${attrs} style="${extra}"`;
}

function macDots() {
  const dot = (color) =>
    `<span style="display:inline-block;width:12px;height:12px;border-radius:6px;background-color:${color};margin-right:8px;font-size:0;line-height:0;vertical-align:top;">&nbsp;</span>`;
  return `<section style="padding:11px 14px 0 14px;line-height:12px;font-size:0;">${dot("#ff5f56")}${dot("#ffbd2e")}${dot("#27c93f")}</section>`;
}

/** 微信会丢掉 ::before，三点写成真实节点；窗口底色跟主题 pre 走。 */
function decorateCodeBlocks(html) {
  return html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_, attrs, inner) => {
    const bg = (attrs.match(/background(?:-color)?\s*:\s*([^;"]+)/i) || [])[1]?.trim() || "#2d2d2d";
    const preAttrs = appendInlineStyle(
      attrs,
      "margin:0;padding:0;background:transparent;overflow:visible;white-space:pre;word-wrap:normal",
    );
    const code = inner
      .replace(/white-space\s*:\s*pre-wrap/gi, "white-space:pre")
      .replace(/word-wrap\s*:\s*break-word/gi, "word-wrap:normal")
      .replace(/border\s*:\s*1px solid [^;"]+/gi, "border:none");
    return (
      `<section style="margin:1em 0;background-color:${bg};border-radius:8px;overflow:hidden;">` +
      macDots() +
      `<section style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding:8px 14px 14px;">` +
      `<pre${preAttrs}>${code}</pre></section></section>`
    );
  });
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

function weixinCgi(cgiPath, token, extraQuery = "") {
  const path = cgiPath.startsWith("/") ? cgiPath : `/${cgiPath}`;
  return `https://api.weixin.qq.com${path}?access_token=${token}${extraQuery}`;
}

function normalizeHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const withScheme = /^https?:\/\//i.test(text) ? text : `http://${text}`;
  return withScheme.replace(/\/$/, "");
}

function loadPublishConfig() {
  loadEnvFile(path.join(root, "wechat", ".env"));
  const file = path.join(root, "wechat", "config.json");
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  return {
    tokenCenterUrl: normalizeHttpUrl(process.env.TOKEN_CENTER_URL),
    tokenCenterApiKey: String(process.env.TOKEN_CENTER_API_KEY || "").trim(),
    appName: String(process.env.WECHAT_APP_NAME || raw.appName || "").trim(),
    author: String(raw.author || "").trim(),
    articlesPerDraft: Math.min(2, Math.max(1, Number(raw.articlesPerDraft) || 2)),
    themes: resolveThemes(raw.theme),
  };
}

function resolveThemes(theme) {
  const catalogPath = path.join(themeDir, "themes.json");
  const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, "utf8")) : [];
  const wanted = String(theme || "").trim();
  if (!wanted) return [{ id: "", name: "", css: "" }];
  const rows = wanted === "all" || wanted === "*"
    ? catalog
    : catalog.filter((row) => row.id === wanted);
  if (!rows.length) throw new Error(`未知主题 ${wanted}，见 wechat/custom-md-css/themes.json`);
  return rows.map((row) => {
    const file = path.join(themeDir, `${row.id}.css`);
    if (!fs.existsSync(file)) throw new Error(`找不到主题 ${file}`);
    return { id: row.id, name: String(row.name || row.id), css: fs.readFileSync(file, "utf8") };
  });
}

function titled(themeName, title) {
  const prefix = themeName ? `${themeName} · ` : "";
  return `${prefix}${title}`.slice(0, 64);
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
      weixinCgi("/cgi-bin/media/uploadimg", token),
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
    weixinCgi("/cgi-bin/material/add_material", token, "&type=image"),
    image.buffer,
    `cover.${image.ext}`,
    image.mime,
  );
  if (!uploaded.media_id) throw new Error("上传封面后没有返回 media_id。");
  return uploaded.media_id;
}

async function convertArticle(article, themeCss) {
  if (!article.md) throw new Error(`${article.id} 还没有渲染出 Markdown，不能上传草稿。`);
  const mdPath = path.join(root, "content", article.md);
  if (!fs.existsSync(mdPath)) throw new Error(`找不到 ${article.md}`);
  const markdown = bodyMarkdown(fs.readFileSync(mdPath, "utf8"));
  const html = decorateCodeBlocks(await getWeChatHtml(markdown, themeCss));
  return { html, mdDir: path.dirname(mdPath) };
}

async function main() {
  const { tokenCenterUrl, tokenCenterApiKey, appName, author, articlesPerDraft, themes } = loadPublishConfig();
  if (!tokenCenterApiKey) throw new Error("请设置 TOKEN_CENTER_API_KEY（wechat/.env 或 Actions secret），这是中控钥匙，不是微信接口。");
  if (!tokenCenterUrl) throw new Error("请设置 TOKEN_CENTER_URL（wechat/.env 或 Actions secret），这是中控地址，不是微信 draft/add。");
  if (!appName) throw new Error("请在 wechat/config.json 填写 appName（中控 apps.json 里的 name）。");

  let queue = normalizeQueue(JSON.parse(fs.readFileSync(queuePath, "utf8")));
  let draftLog = normalizeDraftLog(
    fs.existsSync(draftLogPath) ? JSON.parse(fs.readFileSync(draftLogPath, "utf8")) : {},
  );
  if (!queue.items.length) {
    console.log("没有待上传的公众号排期。");
    return;
  }

  const catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const token = await accessToken(tokenCenterUrl, tokenCenterApiKey, appName);
  const issues = chunkIssues(queue.items, articlesPerDraft);

  for (const issue of issues) {
    const articles = issue.map((item) => {
      const article = (catalog.articles || []).find((row) => row.id === item.id);
      if (!article) throw new Error(`排期里的 ${item.id} 不在 content/index.json`);
      return article;
    });
    const ids = articles.map((article) => article.id);
    for (const theme of themes) {
      const news = [];
      for (const article of articles) {
        const converted = await convertArticle(article, theme.css);
        const withImages = await replaceImages(converted.html, converted.mdDir, token);
        news.push({
          article_type: "news",
          title: titled(theme.name, article.title),
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
        weixinCgi("/cgi-bin/draft/add", token),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articles: news }),
        },
      );
      if (!created.media_id) throw new Error("新建草稿后没有返回 media_id。");
      const titles = news.map((row) => row.title);
      draftLog = appendDraft(draftLog, {
        mediaId: created.media_id,
        appName,
        ids,
        titles,
      });
      fs.writeFileSync(draftLogPath, serializeDraftLog(draftLog), "utf8");
      console.log(`已上传一期草稿（${theme.name || theme.id || "默认"}：${ids.join("、")}）→ ${created.media_id}`);
    }
    queue = removeItems(queue, ids);
    fs.writeFileSync(queuePath, serializeQueue(queue), "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
