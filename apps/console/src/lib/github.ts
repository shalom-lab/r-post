import { allowedGitHubUsers } from "../access-policy";

export const LS_GH_REPO = "gh-repo-rpost";
export const LS_GH_TOKEN = "gh-token-rpost";

export const SETTINGS_CHANGED = "rpost-settings-changed";

export type AppSettings = {
  repoFull: string;
  pat: string;
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
  };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(LS_GH_REPO, (s.repoFull || "").trim());
  localStorage.setItem(LS_GH_TOKEN, s.pat.trim());
  window.dispatchEvent(new Event(SETTINGS_CHANGED));
}

/** Verify identity against the site policy; never trust a saved success flag. */
export async function probeGitHubAccess(
  settings?: AppSettings,
): Promise<{ ok: boolean; repoFull: string; message: string }> {
  const s = settings || loadSettings();
  try {
    const pat = s.pat.trim();
    if (!pat) throw new Error("请先填写 GitHub Token。");
    if (!allowedGitHubUsers.length) throw new Error("站点尚未配置允许阅读的 GitHub 账号。");
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${pat}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (response.status === 401) throw new Error("Token 无效或已失效，请重新填写。");
    if (!response.ok) throw new Error(`暂时无法验证 GitHub 账号（${response.status}），请稍后重试。`);
    const user = await response.json() as { login?: string };
    if (!user.login || !allowedGitHubUsers.some(login => login.toLowerCase() === user.login!.toLowerCase())) {
      throw new Error("此 GitHub 账号未获准阅读本站。");
    }
    return { ok: true, repoFull: s.repoFull, message: `已验证 ${user.login}，可以阅读文章。` };
  } catch (error) {
    return { ok: false, repoFull: s.repoFull, message: error instanceof Error ? error.message : "验证失败，请重试。" };
  }
}
