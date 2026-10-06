import assert from "node:assert/strict";
import test from "node:test";
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
