export const LS_GH_REPO = "gh-repo-rpost";
export const LS_GH_TOKEN = "gh-token-rpost";

/** Optional DeepSeek workflow filenames (not the default writing path). */
export const WORKFLOWS = {
  topic: "topic-generate.yml",
  post: "post-generate.yml",
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

/** Migrate legacy JSON settings into flat localStorage keys once. */
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

export function actionsWorkflowUrl(
  settings: AppSettings,
  workflowFile: string,
): string {
  const { owner, repo } = parseRepoFull(
    settings.repoFull || localStorage.getItem(LS_GH_REPO) || "",
  );
  return `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;
}

/** Probe whether the configured repo is readable (does not expose the token). */
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
