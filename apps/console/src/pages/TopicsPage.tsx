import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OutlineView from "./OutlineView";
import {
  type Category,
  type PromptPack,
  type TopicItem,
  type TopicsFile,
  fetchCategories,
  fetchTopicRulesIndex,
  fetchTopics,
} from "../lib/content";
import {
  dispatchGenerate,
  dispatchIdeate,
  loadSettings,
  readRepoJson,
  saveTopicsFile,
  type TopicsPayload,
} from "../lib/github";

function newId() {
  return `topic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TopicsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [store, setStore] = useState<TopicsFile | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [topicPacks, setTopicPacks] = useState<PromptPack[]>([]);
  const [topicPromptId, setTopicPromptId] = useState("default");
  const [filter, setFilter] = useState<"all" | "open" | "done">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ideateCategoryId, setIdeateCategoryId] = useState("");
  const [quota, setQuota] = useState("5");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", blurb: "", categoryId: "" });

  async function reloadStatic() {
    const [t, c, prompts] = await Promise.all([
      fetchTopics(),
      fetchCategories(),
      fetchTopicRulesIndex(),
    ]);
    setStore(t);
    setCats(c.categories || []);
    setQuota(String(t.meta?.dailyQuota ?? 5));
    setTopicPacks((prompts.packs || []).filter((p) => p.active !== false));
    setTopicPromptId(
      t.meta?.topicPromptId || prompts.defaultPromptId || "default",
    );
  }

  async function pullFromRepo() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const settings = loadSettings();
      const live = await readRepoJson<TopicsFile>(settings, "topics/index.json");
      if (!live) throw new Error("仓库中没有 topics/index.json");
      setStore(live);
      setQuota(String(live.meta?.dailyQuota ?? 5));
      if (live.meta?.topicPromptId) setTopicPromptId(live.meta.topicPromptId);
      setMsg("已从仓库拉取最新选题（绕过 Pages 静态缓存）");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    reloadStatic().catch((e: Error) => setError(e.message));
  }, []);

  const items = useMemo(() => {
    let list = store?.items || [];
    if (search.trim()) list = list.filter(i => (i.title + " " + (i.blurb || "")).toLowerCase().includes(search.trim().toLowerCase()));
    if (categoryFilter) {
      list = list.filter((i) => i.categoryId === categoryFilter);
    }
    if (filter === "open") {
      return list.filter((i) => !i.articleId);
    }
    if (filter === "done") return list.filter((i) => i.articleId);
    return list;
  }, [store, filter, categoryFilter, search]);

  const statusCounts = useMemo(() => {
    const all = store?.items || [];
    return {
      all: all.length,
      open: all.filter((i) => !i.articleId).length,
      done: all.filter((i) => Boolean(i.articleId)).length,
    };
  }, [store]);

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setEditingId(null);
    }
  }, [items, selectedId]);

  useEffect(() => {
    function closeDetail(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedId(null);
        setEditingId(null);
      }
    }
    window.addEventListener("keydown", closeDetail);
    return () => window.removeEventListener("keydown", closeDetail);
  }, []);

  async function withLiveStore(
    mutator: (live: TopicsPayload) => void,
    message: string,
  ) {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const settings = loadSettings();
      const live =
        (await readRepoJson<TopicsPayload>(settings, "topics/index.json")) ||
        (store as unknown as TopicsPayload);
      if (!live) throw new Error("无法加载选题数据，请刷新后重试");
      if (!live.items) live.items = [];
      mutator(live);
      await saveTopicsFile(settings, live, message);
      setMsg("已写回 topics/index.json");
      setStore(live as unknown as TopicsFile);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: TopicItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      blurb: item.blurb || "",
      categoryId: item.categoryId || "",
    });
  }

  async function onSaveEdit(id: string) {
    if (!draft.title.trim()) { setError("请填写标题"); return; }
    const saved = await withLiveStore((live) => {
      const row = live.items.find((i) => i.id === id) as TopicItem | undefined;
      if (!row) return;
      row.title = draft.title.trim() || row.title;
      row.blurb = draft.blurb.trim();
      row.categoryId = draft.categoryId || null;
      row.updatedAt = new Date().toISOString();
    }, `topics: edit ${id}`);
    if (saved) setEditingId(null);
  }

  async function onPass(item: TopicItem) {
    if (!window.confirm(`删除选题「${item.title}」？该条目将从 JSON 移除，且无法恢复。`)) {
      return;
    }
    const removed = await withLiveStore((live) => {
      live.items = live.items.filter((i) => i.id !== item.id);
    }, `topics: pass-delete ${item.id}`);
    if (removed) {
      setSelectedId(null);
      setEditingId(null);
    }
  }

  async function onAdd() {
    const title = newTitle;
    if (!title?.trim()) return;
    const now = new Date().toISOString();
    const saved = await withLiveStore((live) => {
      live.items = [
        {
          id: newId(),
          title: title.trim(),
          blurb: "",
          categoryId: ideateCategoryId || null,
          angle: null,
          outline: null,
          outlinedAt: null,
          articleId: null,
          createdAt: now,
          updatedAt: now,
        },
        ...live.items,
      ];
    }, "topics: add manual");
    if (saved) setNewTitle("");
  }

  async function onIdeate() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      if (!Number.isInteger(Number(quota)) || Number(quota) < 1 || Number(quota) > 20) throw new Error("每次数量请设为 1–20 的整数");
      const url = await dispatchIdeate(loadSettings(), {
        quota,
        promptId: topicPromptId,
        categoryId: ideateCategoryId,
      });
      setRunUrl(url);
      setMsg("已触发 AI 选题（每条附带大纲）");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveQuota() {
    if (!Number.isInteger(Number(quota)) || Number(quota) < 1 || Number(quota) > 20) { setError("每天数量请设为 1–20 的整数"); return; }
    return withLiveStore((live) => {
      live.meta = live.meta || { dailyQuota: 5 };
      live.meta.dailyQuota = Number(quota) || 5;
      live.meta.topicPromptId = topicPromptId;
    }, "topics: update meta prompts");
  }

  async function onGeneratePost(item: TopicItem) {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchGenerate(loadSettings(), { topicId: item.id, categoryId: item.categoryId || "" });
      setRunUrl(url);
      setMsg(`已触发写作：${item.title}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selected = store?.items.find(i => i.id === selectedId);
  const tabs = [["all", "全部"], ["open", "候选"], ["done", "已撰写"]] as const;
  return <section className="panel topic-studio">
    <div className="panel-head">
      <div><span className="eyebrow">TOPIC / 01</span><h1>把值得写的题，留下来。</h1><p className="muted">查看题目和大纲，选中后直接生成稿件。</p></div>
      <div className="row"><button className="btn" disabled={busy} onClick={pullFromRepo}>刷新</button>
        <button className="btn primary" aria-expanded={showGenerator} onClick={()=>setShowGenerator(!showGenerator)}>＋ 生成选题</button></div>
    </div>
    {showGenerator && <section className="generator-box" aria-label="生成选题">
      <div><h2>下一批，想写什么？</h2><p className="muted">每条包含题目、真实数据与简短大纲。生成后再挑选。</p></div>
      <div className="generator-fields">
        <label>数量<input type="number" min="1" max="20" value={quota} onChange={e=>setQuota(e.target.value)}/></label>
        <label>选题风格<select value={topicPromptId} onChange={e=>setTopicPromptId(e.target.value)}>{topicPacks.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label>内容方向<select value={ideateCategoryId} onChange={e=>setIdeateCategoryId(e.target.value)}><option value="">不限方向</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button className="btn primary" disabled={busy || !topicPacks.length} onClick={onIdeate}>{busy ? "处理中…" : "生成题目与大纲"}</button>
      </div>
      <details className="secondary-settings"><summary>默认设置</summary><div className="row"><button className="btn" disabled={busy} onClick={onSaveQuota}>保存数量与默认风格</button><Link to="/prompts">管理提示词 →</Link></div></details>
    </section>}
    <div className="topics-filter"><div className="seg" aria-label="选题状态">{tabs.map(([k,label])=><button key={k} aria-pressed={filter===k} className={filter===k?"is-active":""} onClick={()=>setFilter(k)}><span>{label}</span><small>{statusCounts[k]}</small></button>)}</div>
      <input className="topic-search" aria-label="搜索选题" placeholder="搜索题目或简介…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <select aria-label="按分类筛选" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">全部分类</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {msg && <p role="status" className="ok">{msg} {runUrl && <a href={runUrl} target="_blank" rel="noreferrer">查看运行 →</a>}</p>}
    <div className={selected ? "topic-workspace has-detail" : "topic-workspace"}>
      <div>
        <form className="quick-add" onSubmit={e=>{e.preventDefault();void onAdd();}}><input aria-label="手动选题标题" placeholder="＋ 记下一个自己的选题…" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/><button className="btn" disabled={busy || !newTitle.trim()}>添加</button></form>
        <ul className="topic-candidates">{items.map(item=><li key={item.id} className={selectedId===item.id?"selected":""}>
          <button className="candidate-content" aria-expanded={selectedId===item.id} onClick={()=>{setSelectedId(selectedId===item.id?null:item.id);setEditingId(null);}}>
            <strong>{item.title}</strong><span>{item.blurb || "点击补充想法与大纲"}</span><small>{item.articleId?"已撰写":"候选"} · {cats.find(c=>c.id===item.categoryId)?.name || "未分类"} · {item.outline?"查看大纲":"暂无大纲"}</small>
          </button><span className="candidate-arrow" aria-hidden="true">›</span>
        </li>)}</ul>
        {!store && !error && <p className="empty-state">正在加载选题…</p>}
        {store && !items.length && <div className="empty-state"><p>{search || categoryFilter || filter !== "all" ? "没有匹配的选题，试试调整筛选。" : "这里还没有选题。生成一批，或者记下自己的想法。"}</p>{(search || categoryFilter || filter !== "all") && <button className="btn" onClick={()=>{setSearch("");setCategoryFilter("");setFilter("all");}}>清除筛选</button>}</div>}
      </div>
      {selected && <aside className="topic-detail">
        <div className="pane-bar"><span className="eyebrow">选题详情</span><button className="btn" onClick={()=>setSelectedId(null)} aria-label="隐藏选题详情">收起 ×</button></div>
        {editingId===selected.id ? <div className="todo-edit">
          <label>题目<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
          <label>简介<textarea rows={3} value={draft.blurb} onChange={e=>setDraft({...draft,blurb:e.target.value})}/></label>
          <label>成稿分类<select value={draft.categoryId} onChange={e=>setDraft({...draft,categoryId:e.target.value})}><option value="">未分类</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="row"><button className="btn primary" disabled={busy} onClick={()=>onSaveEdit(selected.id)}>保存修改</button><button className="btn" onClick={()=>setEditingId(null)}>取消</button></div>
        </div> : <><h2>{selected.title}</h2><p className="muted">{selected.blurb}</p><OutlineView outline={selected.outline}/></>}
        <div className="detail-actions">
          {!selected.articleId && <button className="btn primary" disabled={busy} onClick={()=>onGeneratePost(selected)}>{busy?"触发中…":"撰写这篇 →"}</button>}
          <button className="btn" disabled={busy} onClick={()=>startEdit(selected)}>编辑</button>
          {selected.articleId && <Link className="btn" to={`/article/${selected.articleId}`}>打开稿件</Link>}
          <details><summary>更多操作</summary><div className="row"><button className="btn danger" disabled={busy} onClick={()=>onPass(selected)}>删除选题</button></div></details>
        </div>
      </aside>}
    </div>
  </section>;
}
