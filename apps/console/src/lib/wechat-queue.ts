export type WechatQueueItem = {
  id: string;
  status: "queued" | "drafted" | "error";
  addedAt: string | null;
  mediaId: string | null;
  uploadedAt: string | null;
  error: string | null;
};

export type WechatQueue = {
  items: WechatQueueItem[];
};

export function emptyQueue(): WechatQueue {
  return { items: [] };
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
    seen.add(id);
    const status = item.status === "drafted" || item.status === "error" ? item.status : "queued";
    out.push({
      id,
      status,
      addedAt: item.addedAt ? String(item.addedAt) : null,
      mediaId: item.mediaId ? String(item.mediaId) : null,
      uploadedAt: item.uploadedAt ? String(item.uploadedAt) : null,
      error: item.error ? String(item.error) : null,
    });
  }
  return { items: out };
}

export function pendingItems(queue: WechatQueue) {
  return queue.items.filter((item) => item.status !== "drafted" || !item.mediaId);
}

export function addItem(queue: WechatQueue, id: string, addedAt = new Date().toISOString()): WechatQueue {
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
