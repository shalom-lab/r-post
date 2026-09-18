import { useState } from "react";
import { Link } from "react-router-dom";
import {
  type AppSettings,
  LS_GH_REPO,
  LS_GH_TOKEN,
  WORKFLOWS,
  loadSettings,
  probeGitHubAccess,
  saveSettings,
} from "../lib/github";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [probe, setProbe] = useState<string | null>(null);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function onProbe() {
    setProbe("检测中…");
    const r = await probeGitHubAccess(settings);
    setProbe(r.ok ? `✓ ${r.message}` : `✗ ${r.message}`);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>设置</h1>
          <p className="muted">
            flat localStorage：<code>{LS_GH_REPO}</code> /{" "}
            <code>{LS_GH_TOKEN}</code>。勿用 <code>VITE_*</code>{" "}
            注入 Token（会进浏览器包）。推荐 fine-grained PAT：Contents
            Read/Write + Actions Write。workflow 写死为{" "}
            <code>{WORKFLOWS.topic}</code> / <code>{WORKFLOWS.post}</code>
            。提示词见 <Link to="/prompts">提示词</Link>。
          </p>
        </div>
      </div>

      <div className="toolbar">
        <button type="button" className="btn" onClick={onProbe}>
          探测能否读仓库
        </button>
      </div>
      {probe && <p className={probe.startsWith("✓") ? "ok" : "error"}>{probe}</p>}

      <form className="form" onSubmit={onSave}>
        <label>
          {LS_GH_REPO}（owner/repo）
          <input
            value={settings.repoFull}
            onChange={(e) =>
              setSettings({ ...settings, repoFull: e.target.value })
            }
            placeholder="your-name/RPost"
          />
        </label>
        <label>
          {LS_GH_TOKEN}
          <input
            type="password"
            value={settings.pat}
            onChange={(e) => setSettings({ ...settings, pat: e.target.value })}
            autoComplete="off"
            placeholder="ghp_…"
          />
        </label>
        <button className="btn primary" type="submit">
          保存到本机
        </button>
        {saved && <span className="ok">已保存</span>}
      </form>

      <div className="rules-box">
        <h2>写入示例（flat）</h2>
        <pre className="code-block">{`localStorage.setItem("${LS_GH_REPO}", "your-name/RPost")
localStorage.setItem("${LS_GH_TOKEN}", "ghp_xxx")`}</pre>
      </div>
    </section>
  );
}
