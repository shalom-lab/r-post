import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LS_GH_REPO,
  LS_GH_TOKEN,
  loadSettings,
  probeGitHubAccess,
  saveSettings,
} from "../lib/github";
import { cacheClear } from "../lib/local-cache";

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function testConnection() {
    setBusy(true);
    setMessage("");
    setOk(false);
    try {
      saveSettings(settings);
      const result = await probeGitHubAccess(settings);
      setOk(result.ok);
      setMessage(result.message);
    } catch (reason) {
      setOk(false);
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="connection-page">
      <header>
        <span className="eyebrow">连接</span>
        <h1>GitHub 连接</h1>
        <p>阅读需要获准账号的有效 GitHub Token。Token 只保存在当前浏览器。查看文章只做身份验证；改公众号排期还需要这个仓库的 Contents 写权限，触发上传草稿还需要 Actions 权限。</p>
      </header>
      <div className="connection-panel">
        <label>
          GitHub 仓库
          <input
            disabled={busy}
            value={settings.repoFull}
            onChange={(event) => { setOk(false); setSettings({ ...settings, repoFull: event.target.value }); }}
            placeholder="owner/repo"
          />
        </label>
        <label>
          GitHub Personal Access Token
          <input
            disabled={busy}
            type="password"
            value={settings.pat}
            onChange={(event) => { setOk(false); setSettings({ ...settings, pat: event.target.value }); }}
            placeholder="github_pat_..."
            autoComplete="off"
          />
        </label>
        <button disabled={busy} onClick={testConnection}>
          {busy ? "验证中…" : "保存并验证"}
        </button>
        <button disabled={busy} onClick={() => { const cleared = { ...settings, pat: "" }; saveSettings(cleared); setSettings(cleared); setOk(false); setMessage("已清除 Token。"); }}>清除 Token</button>
        <button
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                await cacheClear();
                setOk(true);
                setMessage("已清除文章/封面本地缓存。下次打开会重新拉取。");
              } catch (reason) {
                setOk(false);
                setMessage(reason instanceof Error ? reason.message : "清除缓存失败。");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          清除阅读缓存
        </button>
        {message && <p className={ok ? "connection-ok" : "connection-error"}>{message}</p>}
        {ok && <p><Link to="/">进入文章</Link></p>}
        <details>
          <summary>本地设置</summary>
          <p><code>{LS_GH_REPO}</code> 与 <code>{LS_GH_TOKEN}</code> 分别保存仓库和 Token。</p>
          <p>文章清单、正文、封面清单缓存在浏览器 IndexedDB；有更新会后台校验并刷新。Token 不进 IndexedDB。</p>
        </details>
      </div>
    </section>
  );
}
