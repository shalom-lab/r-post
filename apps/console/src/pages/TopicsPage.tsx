import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  dispatchOutline,
  loadSettings,
  readRepoJson,
  saveTopicsFile,
  type TopicsPayload,
} from "../lib/github";

function newId() {
  return `topic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TopicsPage() {
  const [store, setStore] = useState<TopicsFile | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [topicPacks, setTopicPacks] = useState<PromptPack[]>([]);
  const [topicPromptId, setTopicPromptId] = useState("default");
  const [filter, setFilter] = useState<"all" | "open" | "scheduled" | "done">(
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
    if (categoryFilter) {
      list = list.filter((i) => i.categoryId === categoryFilter);
    }
    if (filter === "open") {
      return list.filter((i) => !i.scheduled && !i.articleId);
    }
    if (filter === "scheduled") return list.filter((i) => i.scheduled);
    if (filter === "done") return list.filter((i) => i.articleId);
    return list;
  }, [store, filter, categoryFilter]);

  const scheduleRank = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const i of store?.items || []) {
      if (i.scheduled && !i.articleId) {
        n += 1;
        map.set(i.id, n);
      }
    }
    return map;
  }, [store]);

  const scheduledCount = (store?.items || []).filter(
    (i) => i.scheduled && !i.articleId,
  ).length;

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
      if (!live.items) live.items = [];
      mutator(live);
      await saveTopicsFile(settings, live, message);
      setMsg("已写回 topics/index.json");
      setStore(live as unknown as TopicsFile);
    } catch (e) {
      setError((e as Error).message);
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

  function onSaveEdit(id: string) {
    return withLiveStore((live) => {
      const row = live.items.find((i) => i.id === id) as TopicItem | undefined;
      if (!row) return;
      row.title = draft.title.trim() || row.title;
      row.blurb = draft.blurb.trim();
      row.categoryId = draft.categoryId || null;
      row.updatedAt = new Date().toISOString();
      setEditingId(null);
    }, `topics: edit ${id}`);
  }

  function onPass(item: TopicItem) {
    if (!window.confirm(`Pass 并删除「${item.title}」？将从 JSON 移除，不可恢复。`)) {
      return;
    }
    return withLiveStore((live) => {
      live.items = live.items.filter((i) => i.id !== item.id);
    }, `topics: pass-delete ${item.id}`);
  }

  function onToggleScheduled(item: TopicItem) {
    return withLiveStore((live) => {
      const row = live.items.find((i) => i.id === item.id) as
        | TopicItem
        | undefined;
      if (!row) return;
      row.scheduled = !row.scheduled;
      row.updatedAt = new Date().toISOString();
      if (row.scheduled) {
        live.items = [
          ...live.items.filter((i) => i.id !== item.id),
          row as unknown as Record<string, unknown>,
        ];
      }
    }, `topics: schedule ${item.id}`);
  }

  function onMove(item: TopicItem, dir: -1 | 1) {
    return withLiveStore((live) => {
      const idx = live.items.findIndex((i) => i.id === item.id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= live.items.length) return;
      const copy = [...live.items];
      const tmp = copy[idx];
      copy[idx] = copy[j];
      copy[j] = tmp;
      live.items = copy;
    }, `topics: reorder ${item.id}`);
  }

  function onAdd() {
    const title = window.prompt("新选题标题");
    if (!title?.trim()) return;
    const now = new Date().toISOString();
    return withLiveStore((live) => {
      live.items = [
        {
          id: newId(),
          title: title.trim(),
          blurb: "",
          categoryId: ideateCategoryId || null,
          angle: null,
          scheduled: false,
          outline: null,
          outlinedAt: null,
          articleId: null,
          createdAt: now,
          updatedAt: now,
        },
        ...live.items,
      ];
    }, "topics: add manual");
  }

  async function onIdeate() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
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
    return withLiveStore((live) => {
      live.meta = live.meta || { dailyQuota: 5 };
      live.meta.dailyQuota = Number(quota) || 5;
      live.meta.topicPromptId = topicPromptId;
    }, "topics: update meta prompts");
  }

  async function onOutlineScheduled() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchOutline(loadSettings(), "", topicPromptId);
      setRunUrl(url);
      setMsg("已触发：仅为缺大纲的排期项补大纲（兜底）");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateNext() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchGenerate(loadSettings(), { fromScheduled: true });
      setRunUrl(url);
      setMsg("已触发写作：按排期生成下一条稿件");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!store && !error) {
    return (
      <section className="panel">
        <p className="muted">加载选题…</p>
      </section>
    );
  }

  const filterTabs = [
    ["all", "全部"],
    ["open", "待办"],
    ["scheduled", "排期"],
    ["done", "成稿"],
  ] as const;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>选题</h1>
          <p className="muted">
            AI 出题+大纲 → 勾选排期 → 写作。提示词见{" "}
            <Link to="/prompts">提示词</Link>。
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={pullFromRepo}>
            拉取
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onAdd}>
            手动加
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={onIdeate}
          >
            AI 选题
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || scheduledCount === 0}
            onClick={onGenerateNext}
          >
            写作下一条（{scheduledCount}）
          </button>
        </div>
      </div>

      <div className="topics-setup">
        <label className="inline">
          条数
          <input
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="input-sm"
          />
        </label>
        <label className="inline">
          Prompt
          <select
            value={topicPromptId}
            onChange={(e) => setTopicPromptId(e.target.value)}
          >
            {topicPacks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="inline">
          分类
          <select
            value={ideateCategoryId}
            onChange={(e) => setIdeateCategoryId(e.target.value)}
          >
            <option value="">不限</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={busy} onClick={onSaveQuota}>
          保存
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={onOutlineScheduled}
          title="仅为缺大纲的排期项补大纲"
        >
          补大纲
        </button>
      </div>

      <div className="topics-filter">
        <div className="seg" role="tablist">
          {filterTabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={filter === k}
              className={filter === k ? "is-active" : ""}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="按分类筛选"
        >
          <option value="">全部分类</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {msg && <p className="ok">{msg}</p>}
      {runUrl && (
        <p className="ok">
          Actions：{" "}
          <a href={runUrl} target="_blank" rel="noreferrer">
            查看运行
          </a>
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <ul className="todo-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`todo-row ${item.scheduled ? "is-scheduled" : ""} ${item.articleId ? "is-done" : ""}`}
          >
            <label className="todo-check" title="勾选加入排期">
              <input
                type="checkbox"
                checked={Boolean(item.scheduled)}
                disabled={busy || Boolean(item.articleId)}
                onChange={() => onToggleScheduled(item)}
              />
            </label>

            <div className="todo-body">
              {editingId === item.id ? (
                <div className="todo-edit">
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                  <textarea
                    rows={2}
                    value={draft.blurb}
                    onChange={(e) =>
                      setDraft({ ...draft, blurb: e.target.value })
                    }
                    placeholder="简介"
                  />
                  <select
                    value={draft.categoryId}
                    onChange={(e) =>
                      setDraft({ ...draft, categoryId: e.target.value })
                    }
                  >
                    <option value="">分类（可选）</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="row">
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busy}
                      onClick={() => onSaveEdit(item.id)}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <strong>
                    {scheduleRank.has(item.id) && (
                      <span className="rank">#{scheduleRank.get(item.id)}</span>
                    )}
                    {item.title}
                  </strong>
                  {item.blurb && <p className="muted blurb">{item.blurb}</p>}
                  <span className="meta">
                    {item.categoryId ? `${item.categoryId} · ` : ""}
                    {item.articleId
                      ? `成稿 ${item.articleId}`
                      : item.scheduled
                        ? "已排期"
                        : "待办"}
                    {item.outline ? " · 大纲" : ""}
                  </span>
                </>
              )}
            </div>

            <div className="todo-actions">
              <button
                type="button"
                className="btn icon-only"
                disabled={busy}
                onClick={() => onMove(item, -1)}
                title="上移"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn icon-only"
                disabled={busy}
                onClick={() => onMove(item, 1)}
                title="下移"
              >
                ↓
              </button>
              {editingId !== item.id && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => startEdit(item)}
                >
                  改
                </button>
              )}
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={() => onPass(item)}
              >
                Pass
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!items.length && <p className="muted">当前筛选下没有选题。</p>}
    </section>
  );
}
