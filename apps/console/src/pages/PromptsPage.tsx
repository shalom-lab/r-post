import { useEffect, useMemo, useState } from "react";
import {
  type PromptPack,
  type PromptRulesIndex,
  type PromptSection,
  fetchPromptFile,
  fetchPromptRulesIndex,
} from "../lib/content";
import {
  deleteRepoFile,
  loadSettings,
  putRepoFile,
  readRepoJson,
  savePromptRulesIndex,
  type PromptRulesPayload,
} from "../lib/github";

type MainTab = "topic" | "post";

const TEMPLATES: Record<MainTab, string> = {
  topic:
    "# 选题助手（风暴 + 大纲合一）\n\n用户消息会标明 模式：ideate 或 模式：outline。\n\n## 角色\n\n…\n\n## 模式 ideate\n\n输出 JSON 数组。\n\n## 模式 outline\n\n输出一个 JSON 对象。\n",
  post: "# 写作提示词\n\n## 角色\n\n…\n\n## 输出格式\n\n只输出合法 Quarto .qmd。\n",
};

function promptFileName(kind: MainTab, id: string) {
  return `${kind}_prompt_${id}.md`;
}

export default function PromptsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [main, setMain] = useState<MainTab>("topic");
  const [index, setIndex] = useState<PromptRulesIndex | null>(null);
  const [preview, setPreview] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newId, setNewId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newBody, setNewBody] = useState(TEMPLATES.topic);

  async function reload() {
    setIndex(await fetchPromptRulesIndex());
  }

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setNewBody(TEMPLATES[main]);
    setPreview("");
    setPreviewId("");
  }, [main]);

  const section: PromptSection | null = index?.[main] ?? null;
  const packs: PromptPack[] = useMemo(() => section?.packs || [], [section]);
  const defaultId = section?.defaultPromptId;

  async function loadLiveIndex(): Promise<PromptRulesPayload> {
    const settings = loadSettings();
    const live =
      (await readRepoJson<PromptRulesPayload>(
        settings,
        "prompt-rules/index.json",
      )) || (index as PromptRulesPayload);
    if (!live.topic) live.topic = { defaultPromptId: "", packs: [] };
    if (!live.post) live.post = { defaultPromptId: "", packs: [] };
    return live;
  }

  async function persist(
    live: PromptRulesPayload,
    message: string,
  ): Promise<void> {
    const settings = loadSettings();
    await savePromptRulesIndex(settings, live, message);
    setIndex(live as PromptRulesIndex);
  }

  async function openPack(pack: PromptPack) {
    setError(null);
    try { const text = await fetchPromptFile(pack.file); setPreview(text); setPreviewId(pack.id); }
    catch(e) { setError((e as Error).message); }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setError(null);
    try {
      const live = await loadLiveIndex();
      if (!live[main].packs.some(p=>p.id===id && p.active!==false)) throw new Error("请先启用这套提示词");
      live[main].defaultPromptId = id;
      await persist(live, `prompt-rules: ${main} default ${id}`);
      setMsg(`默认已设为 ${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(pack: PromptPack) {
    setBusy(true);
    setError(null);
    try {
      const live = await loadLiveIndex();
      const row = live[main].packs.find((p) => p.id === pack.id);
      if (row && row.active !== false && live[main].defaultPromptId === row.id) throw new Error("请先选择其他默认提示词，再停用这一套");
      if (row) row.active = !(row.active !== false);
      await persist(live, `prompt-rules: ${main} toggle ${pack.id}`);
      setMsg("已更新启用状态");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(pack: PromptPack) {
    if (!window.confirm(`删除「${pack.title}」？将从 index 移除并删除 md。`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const settings = loadSettings();
      await deleteRepoFile(settings, {
        path: `prompt-rules/${pack.file}`,
        message: `prompt-rules: delete ${pack.id}`,
      });
      const live = await loadLiveIndex();
      live[main].packs = live[main].packs.filter((p) => p.id !== pack.id);
      if (live[main].defaultPromptId === pack.id) {
        live[main].defaultPromptId = live[main].packs.find(p=>p.active!==false)?.id || "";
      }
      await persist(live, `prompt-rules: ${main} remove ${pack.id}`);
      if (previewId === pack.id) {
        setPreviewId("");
        setPreview("");
      }
      setMsg(`已删除 ${pack.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const settings = loadSettings();
      const id = newId.trim();
      if (!/^[a-z0-9-]+$/.test(id)) {
        throw new Error("id 仅允许小写字母、数字、短横线");
      }
      const existing = await loadLiveIndex();
      if (existing[main].packs.some(p=>p.id===id)) throw new Error("这个 id 已存在，请编辑原提示词或换一个 id");
      const file = promptFileName(main, id);
      await putRepoFile(settings, {
        path: `prompt-rules/${file}`,
        content: newBody.endsWith("\n") ? newBody : `${newBody}\n`,
        message: `prompt-rules: add ${file}`,
      });
      const pack: PromptPack = {
        id,
        title: newTitle.trim() || id,
        file,
        description: newDesc.trim(),
        active: true,
        updatedAt: new Date().toISOString(),
      };
      const live = await loadLiveIndex();
      live[main].packs = [pack, ...live[main].packs.filter((p) => p.id !== id)];
      if (!live[main].defaultPromptId) live[main].defaultPromptId = id;
      await persist(live, `prompt-rules: ${main} index add ${id}`);
      setMsg(`已创建 ${file}`);
      setNewId("");
      setNewTitle("");
      setNewDesc("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSavePreview() {
    const pack = packs.find((p) => p.id === previewId);
    if (!pack) return;
    setBusy(true);
    setError(null);
    try {
      const settings = loadSettings();
      await putRepoFile(settings, {
        path: `prompt-rules/${pack.file}`,
        content: preview.endsWith("\n") ? preview : `${preview}\n`,
        message: `prompt-rules: update ${pack.file}`,
      });
      setMsg(`已保存 ${pack.file}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">PROMPTS / 03</span><h1>让每篇文章，都有自己的写法。</h1>
          <p className="muted">
            选题决定写什么，写作决定怎么讲。选择默认风格，或调整成自己的语气。
          </p>
        </div><button className="btn primary" aria-expanded={showCreate} onClick={()=>setShowCreate(!showCreate)}>＋ 新建提示词</button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={main === "topic" ? "active" : ""}
          onClick={() => setMain("topic")}
        >
          选题 Prompt
        </button>
        <button
          type="button"
          className={main === "post" ? "active" : ""}
          onClick={() => setMain("post")}
        >
          写作 Prompt
        </button>
      </div>

      <p className="muted">{main === "topic" ? "一起生成题目与大纲，帮助你挑选下一篇。" : "控制篇幅、语气和代码讲解方式。"}</p>

      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      {packs.length > 0 && (
        <ul className="simple-list">
          {packs.map((p) => (
            <li key={p.id} className="simple-row prompt-row">
              <div className="simple-main">
                <strong>
                  {p.title}{" "}
                  {defaultId === p.id && <span className="badge">默认</span>}
                </strong>
                <span className="meta">
                  {p.active === false ? "已停用" : "可使用"}
                  {p.description ? ` · ${p.description}` : ""}
                </span>
              </div>
              <div className="data-actions">
                <button type="button" className="btn" onClick={() => openPack(p)}>
                  编辑
                </button>
                <details className="prompt-more"><summary>更多</summary><div className="row"><button
                  type="button"
                  className="btn"
                  disabled={busy || p.active === false || defaultId === p.id}
                  onClick={() => setDefault(p.id)}
                >
                  默认
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => toggleActive(p)}
                >
                  {p.active === false ? "启用" : "停用"}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => onDelete(p)}
                >
                  删除
                </button></div></details>
              </div>
            </li>
          ))}
        </ul>
      )}

      {previewId && (
        <div className="rules-box">
          <div className="pane-bar"><h2>编辑：{packs.find(p=>p.id===previewId)?.title}</h2><button className="btn" onClick={()=>setPreviewId("")}>收起 ×</button></div>
          <textarea
            className="mono full"
            rows={14}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={onSavePreview}
            >
              保存到仓库
            </button>
          </div>
        </div>
      )}

      {showCreate && <form className="form form-wide generator-box" onSubmit={onCreate}>
        <h2>新建{main === "post" ? "写作" : "选题"} Prompt</h2>
        <label>
          id
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="my-prompt"
            required
          />
        </label>
        <label>
          标题
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </label>
        <label>
          说明
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        </label>
        <label>
          正文 md（将存为 {promptFileName(main, newId || "…")}）
          <textarea
            className="mono"
            rows={10}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          创建
        </button>
      </form>}
    </section>
  );
}
