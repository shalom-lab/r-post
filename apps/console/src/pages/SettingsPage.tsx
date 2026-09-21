import { useState } from "react";
import { Link } from "react-router-dom";
import { type AppSettings, LS_GH_REPO, LS_GH_TOKEN, loadSettings, probeGitHubAccess, saveSettings } from "../lib/github";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [probe, setProbe] = useState<{ok:boolean; message:string} | null>(null);
  function update(key: "repoFull" | "pat", value: string) {
    setSettings({...settings,[key]:value}); setSaved(false); setProbe(null);
  }
  async function check() {
    setChecking(true);setProbe(null);
    try { setProbe(await probeGitHubAccess(settings)); }
    catch(e) {setProbe({ok:false,message:(e as Error).message});}
    finally {setChecking(false);}
  }
  return <div className="settings-studio">
    <header className="page-heading"><span className="eyebrow">WORKSPACE / 设置</span><h1>为写作，准备好工作台。</h1><p>连接你的仓库，剩下的交给云端工作流。</p></header>
    <div className="settings-grid">
      <section className="panel connection-card">
        <div className="connection-heading"><span className="service-icon" aria-hidden="true">↗</span><div><h2>连接 GitHub</h2><p className="muted">选题、稿件与提示词都保存在你的仓库。</p></div><span className={'connection-state '+(probe?.ok?'verified':'')}>{probe?.ok?'已验证':'待验证'}</span></div>
        <form className="connection-form" onSubmit={e=>{e.preventDefault();try{saveSettings(settings);setSaved(true);}catch(err){setProbe({ok:false,message:(err as Error).message});}}}>
          <label htmlFor="repository">仓库</label><input id="repository" value={settings.repoFull} onChange={e=>update('repoFull',e.target.value)} placeholder="your-name/r-post" spellCheck={false}/><p className="field-note">填写 owner/repo，也支持完整的 GitHub 仓库链接。</p>
          <label htmlFor="token">访问令牌 <span className="label-note">Personal Access Token</span></label><input id="token" type="password" value={settings.pat} onChange={e=>update('pat',e.target.value)} autoComplete="off" placeholder="粘贴你的 GitHub Token"/><p className="field-note">需要 Contents 读写、Actions 写入权限。</p>
          <div className="connection-footer"><div className="row"><button className="btn primary" type="submit">保存连接</button><button className="btn" type="button" disabled={checking||!settings.repoFull||!settings.pat} onClick={check}>{checking?'验证中…':'测试连接'}</button></div><span className="save-state" role="status">{saved?'✓ 已保存到本机':'仅保存在当前浏览器'}</span></div>
        </form>
        {probe && <p role="status" className={probe.ok?'ok':'error'}>{probe.message}</p>}
      </section>
      <aside className="settings-guide">
        <div className="guide-title"><span className="eyebrow">QUICK START</span><h2>从想法，到成稿</h2></div>
        <ol className="setup-steps"><li><span>01</span><div><strong>连接自己的仓库</strong><p>保存上方配置，再测试是否可以访问。</p></div></li><li><span>02</span><div><strong>准备 AI 密钥</strong><p>在仓库 Actions Secrets 中添加 <code>DEEPSEEK_API_KEY</code>。</p></div></li><li><span>03</span><div><strong>选一套写作风格</strong><p>调整选题方向与文章语气，就可以开始了。</p><Link to="/prompts">管理提示词 →</Link></div></li></ol>
      </aside>
    </div>
    <details className="storage-details"><summary><span>高级配置</span><span className="muted">localStorage 字段与预先注入</span></summary><div><p className="muted">两个独立字段，直接存字符串。工作流文件名无需配置。</p><pre className="code-block">{`localStorage.setItem("${LS_GH_REPO}", "your-name/r-post");
localStorage.setItem("${LS_GH_TOKEN}", "YOUR_TOKEN");`}</pre></div></details>
  </div>;
}
