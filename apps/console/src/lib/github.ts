export const LS_GH_REPO = "gh-repo-rpost";
export const LS_GH_TOKEN = "gh-token-rpost";

/** workflow 文件名写死 */
export const WORKFLOWS = {
  topic: "topic.yml",
  post: "post.yml",
} as const;

export type AppSettings = {
  repoFull: string;
  pat: string;
  topicWorkflow: string;
  postWorkflow: string;
};

export function parseRepoFull(raw: string): { owner: string; repo: string } {
  let s = (raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^github\.com\//i, "");
  s = s.replace(/\.git$/i, "").replace(/\/$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("仓库格式应为 owner/repo（或 GitHub URL）");
  }
  return { owner: parts[0], repo: parts[1] };
}

/** 一次性把旧 JSON 设置迁到 flat key */
function migrateLegacyFlat(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(LS_GH_REPO) || localStorage.getItem(LS_GH_TOKEN)) {
    return;
  }
  for (const key of ["rpost.settings.v2", "rpost.settings.v1"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const old = JSON.parse(raw) as {
        owner?: string;
        repo?: string;
        repoFull?: string;
        pat?: string;
      };
      const repoFull =
        old.repoFull ||
        (old.owner && old.repo ? `${old.owner}/${old.repo}` : "");
      if (repoFull) localStorage.setItem(LS_GH_REPO, repoFull);
      if (old.pat) localStorage.setItem(LS_GH_TOKEN, old.pat);
      break;
    } catch {
      /* ignore */
    }
  }
}

export function loadSettings(): AppSettings {
  migrateLegacyFlat();
  return {
    repoFull: (localStorage.getItem(LS_GH_REPO) || "").trim(),
    pat: localStorage.getItem(LS_GH_TOKEN) || "",
    topicWorkflow: WORKFLOWS.topic,
    postWorkflow: WORKFLOWS.post,
  };
}

/** flat：只写 repo + token 两个 key */
export function saveSettings(s: AppSettings): void {
  localStorage.setItem(LS_GH_REPO, (s.repoFull || "").trim());
  localStorage.setItem(LS_GH_TOKEN, s.pat || "");
}

function requireRepo(settings: AppSettings) {
  const repoFull = (settings.repoFull || localStorage.getItem(LS_GH_REPO) || "").trim();
  const pat = settings.pat || localStorage.getItem(LS_GH_TOKEN) || "";
  if (!repoFull) {
    throw new Error(
      `请先设置仓库：localStorage.setItem("${LS_GH_REPO}", "owner/RPost")`,
    );
  }
  if (!pat) {
    throw new Error(
      `请先设置 Token：localStorage.setItem("${LS_GH_TOKEN}", "ghp_xxx")`,
    );
  }
  const { owner, repo } = parseRepoFull(repoFull);
  return { owner, repo, pat, repoFull };
}

function ghHeaders(pat: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function resolveDefaultBranch(
  settings: AppSettings,
): Promise<string> {
  const { owner, repo, pat } = requireRepo(settings);
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: ghHeaders(pat),
  });
  if (!res.ok) {
    throw new Error(`读取仓库失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch || "main";
}

async function getFileSha(
  settings: AppSettings,
  path: string,
  branch: string,
): Promise<string | undefined> {
  const { owner, repo, pat } = requireRepo(settings);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(pat) });
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error(`读取 ${path} 失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { sha?: string };
  return data.sha;
}

export async function putRepoFile(
  settings: AppSettings,
  opts: { path: string; content: string; message: string; branch?: string },
): Promise<void> {
  const { owner, repo, pat } = requireRepo(settings);
  const branch = opts.branch || (await resolveDefaultBranch(settings));
  const sha = await getFileSha(settings, opts.path, branch);
  const body: Record<string, string> = {
    message: opts.message,
    content: btoa(unescape(encodeURIComponent(opts.content))),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${opts.path}`,
    {
      method: "PUT",
      headers: ghHeaders(pat),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`写入 ${opts.path} 失败 ${res.status}: ${await res.text()}`);
  }
}

export async function readRepoJson<T>(
  settings: AppSettings,
  path: string,
): Promise<T | null> {
  const { owner, repo, pat } = requireRepo(settings);
  const branch = await resolveDefaultBranch(settings);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(pat) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`读取 ${path} 失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { content?: string };
  if (!data.content) return null;
  const raw = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
  return JSON.parse(raw) as T;
}

export type ContentIndexPayload = {
  articles: Array<{
    id: string;
    title: string;
    categoryId?: string | null;
    promptId?: string | null;
    topicId?: string | null;
    qmd: string | null;
    md: string | null;
    updatedAt: string;
  }>;
  updatedAt: string;
};

export async function upsertArticleInIndex(
  settings: AppSettings,
  article: ContentIndexPayload["articles"][number],
): Promise<void> {
  const branch = await resolveDefaultBranch(settings);
  const path = "content/index.json";
  const existing = await readRepoJson<ContentIndexPayload>(settings, path);
  const index: ContentIndexPayload = existing || {
    articles: [],
    updatedAt: new Date().toISOString(),
  };
  const others = (index.articles || []).filter((a) => a.id !== article.id);
  const next: ContentIndexPayload = {
    articles: [article, ...others].sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    ),
    updatedAt: new Date().toISOString(),
  };
  await putRepoFile(settings, {
    path,
    content: `${JSON.stringify(next, null, 2)}\n`,
    message: `content: index upsert ${article.id}`,
    branch,
  });
}

export function actionsWorkflowUrl(
  settings: AppSettings,
  workflowFile: string,
): string {
  const { owner, repo } = parseRepoFull(
    settings.repoFull || localStorage.getItem(LS_GH_REPO) || "",
  );
  return `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;
}

async function dispatchWorkflow(
  settings: AppSettings,
  workflowFile: string,
  inputs: Record<string, string>,
): Promise<string> {
  const { owner, repo, pat } = requireRepo(settings);
  const branch = await resolveDefaultBranch(settings);
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: ghHeaders(pat),
    body: JSON.stringify({ ref: branch, inputs }),
  });
  if (res.status === 204 || res.ok) {
    return actionsWorkflowUrl(settings, workflowFile);
  }
  throw new Error(`触发失败 ${res.status}: ${await res.text()}`);
}

export async function dispatchGenerate(
  settings: AppSettings,
  inputs: {
    topic?: string;
    slug?: string;
    note?: string;
    promptId?: string;
    topicId?: string;
    categoryId?: string;
    fromScheduled?: boolean;
  },
): Promise<string> {
  const fromScheduled = Boolean(inputs.fromScheduled);
  if (!fromScheduled && !inputs.topic?.trim() && !inputs.topicId?.trim()) {
    throw new Error("需要主题、选题 id，或勾选从已排期队列生成");
  }
  return dispatchWorkflow(settings, settings.postWorkflow, {
    fromScheduled: fromScheduled ? "true" : "false",
    topic: inputs.topic?.trim() || "",
    slug: inputs.slug?.trim() || "",
    note: inputs.note?.trim() || "",
    promptId: inputs.promptId?.trim() || "",
    topicId: inputs.topicId?.trim() || "",
    categoryId: inputs.categoryId?.trim() || "",
  });
}

export async function dispatchIdeate(
  settings: AppSettings,
  inputs: { quota?: string; categoryId?: string; promptId?: string } = {},
): Promise<string> {
  return dispatchWorkflow(settings, settings.topicWorkflow, {
    mode: "ideate",
    quota: inputs.quota?.trim() || "",
    topicId: "",
    promptId: inputs.promptId?.trim() || "",
    categoryId: inputs.categoryId?.trim() || "",
  });
}

export async function dispatchOutline(
  settings: AppSettings,
  topicId = "",
  promptId = "",
): Promise<string> {
  return dispatchWorkflow(settings, settings.topicWorkflow, {
    mode: "outline",
    quota: "",
    topicId: topicId.trim(),
    promptId: promptId.trim(),
    categoryId: "",
  });
}

export type TopicsPayload = {
  meta: {
    dailyQuota: number;
    topicPromptId?: string;
    lastIdeatedAt?: string | null;
  };
  items: Array<Record<string, unknown>>;
  updatedAt?: string;
};

export async function saveTopicsFile(
  settings: AppSettings,
  store: TopicsPayload,
  message: string,
): Promise<void> {
  const branch = await resolveDefaultBranch(settings);
  store.updatedAt = new Date().toISOString();
  await putRepoFile(settings, {
    path: "topics/index.json",
    content: `${JSON.stringify(store, null, 2)}\n`,
    message,
    branch,
  });
}

export type PromptPackPayload = {
  id: string;
  title: string;
  file: string;
  description?: string;
  active?: boolean;
  updatedAt?: string;
};

export type PromptSectionPayload = {
  defaultPromptId: string;
  packs: PromptPackPayload[];
};

export type PromptRulesPayload = {
  topic: PromptSectionPayload;
  post: PromptSectionPayload;
  updatedAt?: string;
};

export async function savePromptRulesIndex(
  settings: AppSettings,
  index: PromptRulesPayload,
  message: string,
): Promise<void> {
  const branch = await resolveDefaultBranch(settings);
  index.updatedAt = new Date().toISOString();
  await putRepoFile(settings, {
    path: "prompt-rules/index.json",
    content: `${JSON.stringify(index, null, 2)}\n`,
    message,
    branch,
  });
}

export async function deleteRepoFile(
  settings: AppSettings,
  opts: { path: string; message: string; branch?: string },
): Promise<void> {
  const { owner, repo, pat } = requireRepo(settings);
  const branch = opts.branch || (await resolveDefaultBranch(settings));
  const sha = await getFileSha(settings, opts.path, branch);
  if (!sha) return;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${opts.path}`,
    {
      method: "DELETE",
      headers: ghHeaders(pat),
      body: JSON.stringify({ message: opts.message, sha, branch }),
    },
  );
  if (!res.ok) {
    throw new Error(`删除 ${opts.path} 失败 ${res.status}: ${await res.text()}`);
  }
}

export type CategoriesPayload = {
  categories: Array<{ id: string; name: string; order?: number }>;
  updatedAt?: string;
};

export async function saveCategories(
  settings: AppSettings,
  file: CategoriesPayload,
  message: string,
): Promise<void> {
  const branch = await resolveDefaultBranch(settings);
  file.updatedAt = new Date().toISOString();
  await putRepoFile(settings, {
    path: "content/categories.json",
    content: `${JSON.stringify(file, null, 2)}\n`,
    message,
    branch,
  });
}

/** 探测仓库是否可读（不暴露 token） */
export async function probeGitHubAccess(
  settings?: AppSettings,
): Promise<{ ok: boolean; repoFull: string; message: string }> {
  try {
    const s = settings || loadSettings();
    const { owner, repo, repoFull } = requireRepo(s);
    const branch = await resolveDefaultBranch(s);
    return {
      ok: true,
      repoFull,
      message: `可读 ${owner}/${repo}（默认分支 ${branch}）`,
    };
  } catch (e) {
    return {
      ok: false,
      repoFull: loadSettings().repoFull || "",
      message: (e as Error).message,
    };
  }
}
