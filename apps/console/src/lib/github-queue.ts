import { allowedGitHubUsers } from "../access-policy";
import {
  loadSettings,
  parseRepoFull,
  type AppSettings,
} from "./github";
import {
  addItem,
  emptyDraftLog,
  emptyQueue,
  moveItem,
  normalizeDraftLog,
  normalizeQueue,
  removeItem,
  serializeQueue,
  type WechatDraftLog,
  type WechatQueue,
} from "./wechat-queue";

const API = "https://api.github.com";
const VERSION = "2022-11-28";
export const QUEUE_PATH = "wechat/queue.json";
export const DRAFT_LOG_PATH = "wechat/wechat_draft.json";
export const DRAFT_WORKFLOW = "wechat-draft.yml";

function ghHeaders(pat: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": VERSION,
  };
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function ghJson(url: string, pat: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(pat), ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function repoContext(settings?: AppSettings) {
  const current = settings || loadSettings();
  const pat = current.pat.trim();
  if (!pat) throw new Error("请先填写 GitHub Token。");
  if (!current.repoFull.trim()) throw new Error("请先在连接页填写仓库，例如 owner/repo。");
  const { owner, repo } = parseRepoFull(current.repoFull);
  const { response, data } = await ghJson(`${API}/repos/${owner}/${repo}`, pat);
  if (response.status === 401) throw new Error("Token 无效或已失效，请重新填写。");
  if (response.status === 404) throw new Error("找不到这个仓库，或 Token 没有访问权限。");
  if (!response.ok) throw new Error(`无法读取仓库信息（${response.status}）。`);
  const login = await fetch(`${API}/user`, { headers: ghHeaders(pat), cache: "no-store" })
    .then((res) => res.json() as Promise<{ login?: string }>);
  if (!login.login || !allowedGitHubUsers.some((name) => name.toLowerCase() === login.login!.toLowerCase())) {
    throw new Error("此 GitHub 账号未获准改排期。");
  }
  return {
    owner,
    repo,
    pat,
    branch: String(data.default_branch || "main"),
  };
}

async function fetchRepoJson(filePath: string, settings?: AppSettings) {
  const { owner, repo, pat, branch } = await repoContext(settings);
  const { response, data } = await ghJson(
    `${API}/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    pat,
  );
  return { response, data };
}

export type QueueRecord = {
  queue: WechatQueue;
  sha: string | null;
};

export async function fetchQueueFile(settings?: AppSettings): Promise<QueueRecord> {
  const { response, data } = await fetchRepoJson(QUEUE_PATH, settings);
  if (response.status === 404) return { queue: emptyQueue(), sha: null };
  if (!response.ok) throw new Error(`无法读取公众号排期（${response.status}）。`);
  const text = decodeBase64(String(data.content || ""));
  return {
    queue: normalizeQueue(JSON.parse(text || "{}")),
    sha: String(data.sha || "") || null,
  };
}

export async function fetchDraftLog(settings?: AppSettings): Promise<WechatDraftLog> {
  const { response, data } = await fetchRepoJson(DRAFT_LOG_PATH, settings);
  if (response.status === 404) return emptyDraftLog();
  if (!response.ok) throw new Error(`无法读取草稿记录（${response.status}）。`);
  const text = decodeBase64(String(data.content || ""));
  return normalizeDraftLog(JSON.parse(text || "{}"));
}

export async function saveQueueFile(
  queue: WechatQueue,
  sha: string | null,
  message: string,
  settings?: AppSettings,
): Promise<QueueRecord> {
  const { owner, repo, pat, branch } = await repoContext(settings);
  const body: Record<string, string> = {
    message,
    content: encodeBase64(serializeQueue(queue)),
    branch,
  };
  if (sha) body.sha = sha;
  const { response, data } = await ghJson(
    `${API}/repos/${owner}/${repo}/contents/${QUEUE_PATH}`,
    pat,
    { method: "PUT", body: JSON.stringify(body) },
  );
  if (response.status === 409 || response.status === 422) {
    throw new Error("排期文件刚才被别人改过，请刷新后再试。");
  }
  if (response.status === 403 || response.status === 404) {
    throw new Error("Token 需要这个仓库的 Contents 写权限，才能保存排期。");
  }
  if (!response.ok) throw new Error(`保存排期失败（${response.status}）。`);
  return {
    queue: normalizeQueue(queue),
    sha: String(data.content?.sha || sha || "") || null,
  };
}

export async function mutateQueue(
  mutate: (queue: WechatQueue) => WechatQueue,
  message: string,
): Promise<WechatQueue> {
  const current = await fetchQueueFile();
  const next = mutate(current.queue);
  const saved = await saveQueueFile(next, current.sha, message);
  return saved.queue;
}

export async function addToQueue(id: string, title: string) {
  return mutateQueue((queue) => addItem(queue, id), `将 ${title} 加入公众号排期`);
}

export async function removeFromQueue(id: string, title: string) {
  return mutateQueue((queue) => removeItem(queue, id), `将 ${title} 移出公众号排期`);
}

export async function moveInQueue(id: string, direction: "up" | "down") {
  return mutateQueue((queue) => moveItem(queue, id, direction), "调整公众号排期顺序");
}

export async function dispatchDraftUpload() {
  const { owner, repo, pat, branch } = await repoContext();
  const pending = (await fetchQueueFile()).queue.items;
  if (!pending.length) throw new Error("没有待上传的排期。");
  const { response, data } = await ghJson(
    `${API}/repos/${owner}/${repo}/actions/workflows/${DRAFT_WORKFLOW}/dispatches`,
    pat,
    { method: "POST", body: JSON.stringify({ ref: branch }) },
  );
  if (response.status === 204) return;
  if (response.status === 403 || response.status === 404) {
    throw new Error("排期已保存。触发上传需要 Token 的 Actions 权限，或在本地运行 npm run wechat:draft。");
  }
  throw new Error(data.message || `无法触发上传草稿（${response.status}）。`);
}
