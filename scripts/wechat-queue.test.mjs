import assert from "node:assert/strict";
import test from "node:test";
import {
  addItem,
  chunkIssues,
  markDrafted,
  moveItem,
  normalizeQueue,
  pendingItems,
  removeItem,
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
    "20260927-wide-to-long",
  ]);
  assert.equal(pendingItems(queue).length, 1);
});

test("add, move, remove, and draft marking follow array order", () => {
  let queue = addItem({ items: [] }, "a", "t1");
  queue = addItem(queue, "b", "t2");
  queue = addItem(queue, "a", "t3");
  assert.deepEqual(queue.items.map((item) => item.id), ["a", "b"]);
  queue = moveItem(queue, "b", "up");
  assert.deepEqual(queue.items.map((item) => item.id), ["b", "a"]);
  queue = markDrafted(queue, ["b", "a"], "media-9", "t4");
  assert.equal(queue.items[0].mediaId, "media-9");
  assert.equal(pendingItems(queue).length, 0);
  queue = removeItem(queue, "b");
  assert.deepEqual(queue.items.map((item) => item.id), ["a"]);
});

test("pending lineup splits into issues of two", () => {
  assert.deepEqual(
    chunkIssues([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }]).map((issue) => issue.map((row) => row.id)),
    [["a", "b"], ["c", "d"], ["e"]],
  );
});
