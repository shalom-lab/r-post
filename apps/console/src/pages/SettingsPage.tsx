import { useState } from "react";
import {
  LS_GH_REPO,
  LS_GH_TOKEN,
  actionsWorkflowUrl,
  loadSettings,
  probeGitHubAccess,
  saveSettings,
} from "../lib/github";

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function testConnection() {
    setBusy(true);
    setMessage("");
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
        <span className="eyebrow">BYOK · 可选连接</span>
        <h1>阅读不需要 Token。</h1>
        <p>连接自己的 GitHub 仓库后，才需要下面的配置。Token 只保存在当前浏览器。</p>
      </header>
      <div className="connection-panel">
        <label>
          GitHub 仓库
          <input
            value={settings.repoFull}
            onChange={(event) => setSettings({ ...settings, repoFull: event.target.value })}
            placeholder="owner/repo"
          />
        </label>
        <label>
          GitHub Personal Access Token
          <input
            type="password"
            value={settings.pat}
            onChange={(event) => setSettings({ ...settings, pat: event.target.value })}
            placeholder="github_pat_..."
            autoComplete="off"
          />
        </label>
        <button disabled={busy || !settings.repoFull || !settings.pat} onClick={testConnection}>
          {busy ? "验证中…" : "保存并验证"}
        </button>
        {message && <p className={ok ? "connection-ok" : "connection-error"}>{message}</p>}
        {ok && (
          <div className="connection-links">
            <a href={actionsWorkflowUrl(settings, settings.topicWorkflow)} target="_blank" rel="noreferrer">
              打开选题 Action
            </a>
            <a href={actionsWorkflowUrl(settings, settings.postWorkflow)} target="_blank" rel="noreferrer">
              打开写作 Action
            </a>
          </div>
        )}
        <details>
          <summary>本地字段与 AI Key</summary>
          <p><code>{LS_GH_REPO}</code> 与 <code>{LS_GH_TOKEN}</code> 分别保存仓库和 Token。</p>
          <p>DeepSeek Key 请配置为仓库 Actions Secret：<code>DEEPSEEK_API_KEY</code>，不会进入网页。</p>
        </details>
      </div>
    </section>
  );
}
