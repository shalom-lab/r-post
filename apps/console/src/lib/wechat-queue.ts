export type WechatQueueItem = {
  id: string;
  addedAt: string | null;
};

export type WechatQueue = {
  items: WechatQueueItem[];
};

export type WechatDraft = {
  source: "rpost";
  appName: string | null;
  mediaId: string;
  uploadedAt: string | null;
  ids: string[];
  titles: string[];
};

export type WechatDraftLog = {
  drafts: WechatDraft[];
};

export function emptyQueue(): WechatQueue {
  return { items: [] };
}

export function emptyDraftLog(): WechatDraftLog {
  return { drafts: [] };
}

export function normalizeQueue(raw: unknown): WechatQueue {
  const source = raw && typeof raw === "object" ? raw as { items?: unknown } : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const seen = new Set<string>();
  const out: WechatQueueItem[] = [];
  for (const row of items) {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const id = String(item.id || "").trim();
    if (!id || seen.has(id)) continue;
    if (item.status === "drafted" && item.mediaId) continue;
    seen.add(id);
    out.push({
      id,
      addedAt: item.addedAt ? String(item.addedAt) : null,
    });
  }
  return { items: out };
}

export function normalizeDraftLog(raw: unknown): WechatDraftLog {
  const source = raw && typeof raw === "object" ? raw as { drafts?: unknown } : {};
  const rows = Array.isArray(source.drafts) ? source.drafts : [];
  const drafts: WechatDraft[] = [];
  const seenMedia = new Set<string>();
  for (const row of rows) {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const source = String(item.source || "");
    if (source !== "rpost") continue;
    const mediaId = String(item.mediaId || "").trim();
    const ids = Array.isArray(item.ids) ? item.ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
    if (!mediaId || !ids.length || seenMedia.has(mediaId)) continue;
    seenMedia.add(mediaId);
    drafts.push({
      source: "rpost",
      appName: item.appName ? String(item.appName) : null,
      mediaId,
      uploadedAt: item.uploadedAt ? String(item.uploadedAt) : null,
      ids,
      titles: Array.isArray(item.titles) ? item.titles.map((title) => String(title || "")) : [],
    });
  }
  return { drafts };
}

export function draftedIdSet(log: WechatDraftLog) {
  const ids = new Set<string>();
  for (const row of normalizeDraftLog(log).drafts) {
    for (const id of row.ids) ids.add(id);
  }
  return ids;
}

export function addItem(queue: WechatQueue, id: string, addedAt = new Date().toISOString()): WechatQueue {
  const next = normalizeQueue(queue);
  if (next.items.some((item) => item.id === id)) return next;
  next.items.push({ id, addedAt });
  return next;
}

export function removeItem(queue: WechatQueue, id: string): WechatQueue {
  const next = normalizeQueue(queue);
  next.items = next.items.filter((item) => item.id !== id);
  return next;
}

export function moveItem(queue: WechatQueue, id: string, direction: "up" | "down"): WechatQueue {
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

export function serializeQueue(queue: WechatQueue) {
  return `${JSON.stringify(normalizeQueue(queue), null, 2)}\n`;
}
