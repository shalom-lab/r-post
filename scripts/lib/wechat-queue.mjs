/** 公众号排期：按数组顺序，用文章文件夹 id 识别。 */

export function emptyQueue() {
  return { items: [] };
}

export function normalizeQueue(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const seen = new Set();
  const out = [];
  for (const row of items) {
    const id = String(row?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const status = row.status === "drafted" || row.status === "error" ? row.status : "queued";
    out.push({
      id,
      status,
      addedAt: row.addedAt || null,
      mediaId: row.mediaId || null,
      uploadedAt: row.uploadedAt || null,
      error: row.error || null,
    });
  }
  return { items: out };
}

export function pendingItems(queue) {
  return queue.items.filter((item) => item.status !== "drafted" || !item.mediaId);
}

/** 每期固定两篇；名单末尾若剩一篇，单独成期。 */
export function chunkIssues(items, size = 2) {
  const per = Math.min(2, Math.max(1, Number(size) || 2));
  const out = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

export function addItem(queue, id, addedAt = new Date().toISOString()) {
  const next = normalizeQueue(queue);
  if (next.items.some((item) => item.id === id)) return next;
  next.items.push({
    id,
    status: "queued",
    addedAt,
    mediaId: null,
    uploadedAt: null,
    error: null,
  });
  return next;
}

export function removeItem(queue, id) {
  const next = normalizeQueue(queue);
  next.items = next.items.filter((item) => item.id !== id);
  return next;
}

export function moveItem(queue, id, direction) {
  const next = normalizeQueue(queue);
  const index = next.items.findIndex((item) => item.id === id);
  if (index < 0) return next;
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= next.items.length) return next;
  const copy = next.items.slice();
  [copy[index], copy[swap]] = [copy[swap], copy[index]];
  next.items = copy;
  return next;
}

export function markDrafted(queue, ids, mediaId, uploadedAt = new Date().toISOString()) {
  const next = normalizeQueue(queue);
  const set = new Set(ids);
  next.items = next.items.map((item) => {
    if (!set.has(item.id)) return item;
    return {
      ...item,
      status: "drafted",
      mediaId,
      uploadedAt,
      error: null,
    };
  });
  return next;
}

export function markError(queue, ids, error) {
  const next = normalizeQueue(queue);
  const set = new Set(ids);
  next.items = next.items.map((item) => {
    if (!set.has(item.id)) return item;
    return { ...item, status: "error", error };
  });
  return next;
}

export function serializeQueue(queue) {
  return `${JSON.stringify(normalizeQueue(queue), null, 2)}\n`;
}
