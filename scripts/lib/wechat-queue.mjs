/** 公众号排期：只记待传名单，按数组顺序，用文章文件夹 id 识别。 */

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
    if (row.status === "drafted" && row.mediaId) continue;
    seen.add(id);
    out.push({
      id,
      addedAt: row.addedAt || null,
    });
  }
  return { items: out };
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
  next.items.push({ id, addedAt });
  return next;
}

export function removeItem(queue, id) {
  const next = normalizeQueue(queue);
  next.items = next.items.filter((item) => item.id !== id);
  return next;
}

export function removeItems(queue, ids) {
  const drop = new Set(ids);
  const next = normalizeQueue(queue);
  next.items = next.items.filter((item) => !drop.has(item.id));
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

export function serializeQueue(queue) {
  return `${JSON.stringify(normalizeQueue(queue), null, 2)}\n`;
}

export const DRAFT_SOURCE = "rpost";

export function emptyDraftLog() {
  return { drafts: [] };
}

export function normalizeDraftLog(raw) {
  const rows = Array.isArray(raw?.drafts) ? raw.drafts : [];
  const drafts = [];
  const seenMedia = new Set();
  for (const row of rows) {
    const source = String(row?.source || "").trim();
    if (source !== DRAFT_SOURCE) continue;
    const mediaId = String(row?.mediaId || "").trim();
    const ids = Array.isArray(row?.ids) ? row.ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
    if (!mediaId || !ids.length || seenMedia.has(mediaId)) continue;
    seenMedia.add(mediaId);
    drafts.push({
      source: DRAFT_SOURCE,
      mediaId,
      uploadedAt: row.uploadedAt || null,
      ids,
      titles: Array.isArray(row?.titles) ? row.titles.map((title) => String(title || "")) : [],
    });
  }
  return { drafts };
}

export function appendDraft(log, entry) {
  const next = normalizeDraftLog(log);
  const mediaId = String(entry.mediaId || "").trim();
  if (!mediaId || next.drafts.some((row) => row.mediaId === mediaId)) return next;
  next.drafts.push({
    source: DRAFT_SOURCE,
    mediaId,
    uploadedAt: entry.uploadedAt || new Date().toISOString(),
    ids: [...entry.ids],
    titles: Array.isArray(entry.titles) ? [...entry.titles] : [],
  });
  return next;
}

export function draftedIdSet(log) {
  const ids = new Set();
  for (const row of normalizeDraftLog(log).drafts) {
    for (const id of row.ids) ids.add(id);
  }
  return ids;
}

export function serializeDraftLog(log) {
  return `${JSON.stringify(normalizeDraftLog(log), null, 2)}\n`;
}
