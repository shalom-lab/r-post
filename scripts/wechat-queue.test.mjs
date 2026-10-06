import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bodyMarkdown } from "./lib/wechat-body-markdown.mjs";
import {
  addItem,
  appendDraft,
  chunkIssues,
  draftedIdSet,
  moveItem,
  normalizeDraftLog,
  normalizeQueue,
  removeItem,
  removeItems,
} from "./lib/wechat-queue.mjs";
import { DEFAULT_THEME, loadThemeCss } from "./lib/wechat-theme-css.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mdcssDir = path.join(root, "mdcss");

test("wechat body drops title, RPost author, and date byline", () => {
  const md = [
    "# 分析做到一半如何存临时数据？",
    "RPost",
    "2026-09-21",
    "",
    "分析做到一半：表洗完了要留着明天接着跑。",
    "",
  ].join("\n");
  assert.equal(
    bodyMarkdown(md),
    "分析做到一半：表洗完了要留着明天接着跑。\n",
  );
});

test("wechat body keeps real opening paragraphs that are not bylines", () => {
  const md = [
    "# 标题",
    "",
    "清洗病历备注时，总有一列文字看着乱。",
    "",
  ].join("\n");
  assert.equal(bodyMarkdown(md), "清洗病历备注时，总有一列文字看着乱。\n");
});

test("default mdcss theme loads 前端之巅 as customCss", () => {
  const css = loadThemeCss(mdcssDir, DEFAULT_THEME);
  assert.match(css, /\/\* 前端之巅 \*\//);
  assert.match(css, /#markmuse\s*\{/);
  assert.match(css, /#markmuse h2/);
});

test("missing mdcss theme throws a clear error", () => {
  assert.throws(() => loadThemeCss(mdcssDir, "不存在的主题"), /找不到主题样式/);
});

test("queue keeps first-seen id order and drops duplicates", () => {
  const queue = normalizeQueue({
    items: [
      { id: "20260921-r-save-five-methods" },
      { id: "20260921-r-save-five-methods" },
      { id: "20260927-wide-to-long", status: "drafted", mediaId: "m1" },
    ],
  });
  assert.deepEqual(queue.items.map((item) => item.id), [
    "20260921-r-save-five-methods",
  ]);
});

test("add, move, and remove follow array order", () => {
  let queue = addItem({ items: [] }, "a", "t1");
  queue = addItem(queue, "b", "t2");
  queue = addItem(queue, "a", "t3");
  assert.deepEqual(queue.items.map((item) => item.id), ["a", "b"]);
  queue = moveItem(queue, "b", "up");
  assert.deepEqual(queue.items.map((item) => item.id), ["b", "a"]);
  queue = removeItem(queue, "b");
  assert.deepEqual(queue.items.map((item) => item.id), ["a"]);
});

test("successful drafts are append-only and leave the queue", () => {
  let queue = addItem(addItem({ items: [] }, "a", "t1"), "b", "t2");
  let log = appendDraft(normalizeDraftLog({}), {
    mediaId: "media-9",
    uploadedAt: "t4",
    ids: ["a", "b"],
    titles: ["甲", "乙"],
  });
  queue = removeItems(queue, ["a", "b"]);
  assert.equal(queue.items.length, 0);
  assert.deepEqual([...draftedIdSet(log)], ["a", "b"]);
  log = appendDraft(log, { mediaId: "media-9", ids: ["a", "b"] });
  assert.equal(log.drafts.length, 1);
  assert.equal(log.drafts[0].source, "rpost");
});

test("draft log ignores WeChat drafts not created by this pipeline", () => {
  const log = normalizeDraftLog({
    drafts: [
      { source: "wechat-manual", mediaId: "hand", ids: ["x"] },
      { mediaId: "no-source", ids: ["y"] },
      { source: "rpost", mediaId: "auto", ids: ["z"], titles: ["丙"] },
    ],
  });
  assert.deepEqual(log.drafts.map((row) => row.mediaId), ["auto"]);
});

test("pending lineup splits into issues of two", () => {
  assert.deepEqual(
    chunkIssues([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]).map((issue) => issue.map((row) => row.id)),
    [["a", "b"], ["c", "d"], ["e"]],
  );
});
