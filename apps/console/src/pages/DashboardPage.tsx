import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type Article,
  type Category,
  type TopicItem,
  type TopicsFile,
  fetchCategories,
  fetchIndex,
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

// ─── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`stat-card${active ? " is-active" : ""}`}
      style={{ "--card-color": color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className="stat-count">{count}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}

// ─── Outline viewer ────────────────────────────────────────────────────────

function OutlinePanel({ outline }: { outline: Record<string, unknown> }) {
  return (
    <div className="outline-panel">
      {outline.workingTitle && (
        <p className="outline-title">{String(outline.workingTitle)}</p>
      )}
      {Array.isArray(outline.sections) && (
        <ol className="outline-sections">
          {(outline.sections as Array<{ heading?: string; points?: string[] }>).map((s, i) => (
            <li key={i}>
              <strong>{s.heading || `第${i + 1}节`}</strong>
              {Array.isArray(s.points) && (
                <ul>
                  {s.points.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      {!outline.sections && (
        <pre className="outline-raw">{JSON.stringify(outline, null, 2)}</pre>
      )}
    </div>
  );
}

// ─── Scheduled queue ────────────────────────────────────────────────────────

function ScheduledQueue({
  items,
  cats,
  busy,
  onToggle,
  onDispatchWrite,
}: {
  items: TopicItem[];
  cats: Category[];
  busy: boolean;
  onToggle: (item: TopicItem) => void;
  onDispatchWrite: (item: TopicItem) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const catName = useMemo(() => {
    const m = new Map(cats.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? m.get(id) || id : "");
  }, [cats]);

  if (items.length === 0) {
    return (
      <p className="muted queue-empty">
        暂无排期。先去{" "}
        <Link to="/topics">选题</Link>{" "}
        勾选要排期的选题，或点上方「AI 选题」生成。
      </p>
    );
  }

  return (
    <ol className="queue-list">
      {items.map((item, idx) => {
        const expanded = expandedId === item.id;
        return (
          <li key={item.id} className={`queue-item${item.outline ? " has-outline" : ""}`}>
            <div className="queue-item-header">
              <span className="queue-rank">#{idx + 1}</span>
              <div className="queue-body">
                <strong className="queue-title">{item.title}</strong>
                {item.blurb && <p className="queue-blurb muted">{item.blurb}</p>}
                <span className="queue-meta muted">
                  {catName(item.categoryId)}
                  {item.outline ? " · 已大纲" : " · 无大纲"}
                </span>
              </div>
              <div className="queue-actions">
                {item.outline && (
                  <button
                    type="button"
                    className="btn icon-only"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    title={expanded ? "收起大纲" : "查看大纲"}
                  >
                    {expanded ? "▲" : "▼"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => onDispatchWrite(item)}
                  title="触发写作此条"
                >
                  写作
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => onToggle(item)}
                  title="移出排期"
                >
                  移出
                </button>
              </div>
            </div>
            {expanded && item.outline && (
              <OutlinePanel outline={item.outline as Record<string, unknown>} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── DashboardPage ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [store, setStore] = useState<TopicsFile | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "scheduled" | "done">("scheduled");

  async function reload() {
    const [t, c, idx] = await Promise.all([
      fetchTopics(),
      fetchCategories(),
      fetchIndex(),
    ]);
    setStore(t);
    setCats(c.categories || []);
    setArticles(idx.articles || []);
  }

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, []);

  const items = store?.items || [];
  const scheduled = items.filter((i) => i.scheduled && !i.articleId);
  const open = items.filter((i) => !i.scheduled && !i.articleId);
  const done = items.filter((i) => i.articleId);

  async function withLive(
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
      setStore(live as unknown as TopicsFile);
      setMsg("已同步到仓库");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onToggleScheduled(item: TopicItem) {
    return withLive((live) => {
      const row = live.items.find((i) => i.id === item.id) as TopicItem | undefined;
      if (!row) return;
      row.scheduled = !row.scheduled;
      row.updatedAt = new Date().toISOString();
    }, `topics: unschedule ${item.id}`);
  }

  async function onIdeate() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchIdeate(loadSettings(), {});
      setRunUrl(url);
      setMsg("已触发 AI 选题（GitHub Actions）");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDispatchWrite(item: TopicItem) {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchGenerate(loadSettings(), {
        topicId: item.id,
        fromScheduled: false,
      });
      setRunUrl(url);
      setMsg(`已触发写作：${item.title}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onWriteNext() {
    setBusy(true);
    setMsg(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchGenerate(loadSettings(), { fromScheduled: true });
      setRunUrl(url);
      setMsg("已触发写作：按排期生成下一条");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const recentArticles = [...articles].slice(0, 6);

  return (
    <div className="dashboard">
      {/* ── 统计条 ── */}
      <div className="stat-bar">
        <StatCard
          label="待办"
          count={open.length}
          color="var(--color-open)"
          active={filter === "open"}
          onClick={() => setFilter(filter === "open" ? "all" : "open")}
        />
        <StatCard
          label="排期中"
          count={scheduled.length}
          color="var(--color-scheduled)"
          active={filter === "scheduled"}
          onClick={() => setFilter(filter === "scheduled" ? "all" : "scheduled")}
        />
        <StatCard
          label="已成稿"
          count={done.length}
          color="var(--color-done)"
          active={filter === "done"}
          onClick={() => setFilter(filter === "done" ? "all" : "done")}
        />
        <div className="stat-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onIdeate}
          >
            AI 选题
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || scheduled.length === 0}
            onClick={onWriteNext}
          >
            写作下一条
          </button>
          <Link className="btn" to="/topics">
            管理选题
          </Link>
        </div>
      </div>

      {msg && <p className="ok toast">{msg}</p>}
      {runUrl && (
        <p className="ok toast">
          Actions：{" "}
          <a href={runUrl} target="_blank" rel="noreferrer">
            查看运行
          </a>
        </p>
      )}
      {error && <p className="error toast">{error}</p>}

      {/* ── 主体双栏 ── */}
      <div className="dashboard-grid">
        {/* 左：排期队列 */}
        <section className="panel dashboard-panel">
          <div className="panel-head">
            <h2>排期队列</h2>
            <span className="badge">{scheduled.length}</span>
          </div>
          <ScheduledQueue
            items={scheduled}
            cats={cats}
            busy={busy}
            onToggle={onToggleScheduled}
            onDispatchWrite={onDispatchWrite}
          />
        </section>

        {/* 右：最新稿件 */}
        <section className="panel dashboard-panel">
          <div className="panel-head">
            <h2>最新稿件</h2>
            <Link className="btn" to="/">
              全部
            </Link>
          </div>
          {recentArticles.length === 0 ? (
            <p className="muted">暂无稿件。</p>
          ) : (
            <ul className="recent-list">
              {recentArticles.map((a) => (
                <li key={a.id}>
                  <Link to={`/article/${a.id}`} className="recent-row">
                    <div className="recent-main">
                      <strong>{a.title}</strong>
                      <span className="muted">
                        {a.updatedAt?.slice(0, 10)}
                        {a.md && " · MD ✓"}
                      </span>
                    </div>
                    <span className={`chip ${a.md ? "chip-ok" : ""}`}>
                      {a.md ? "渲染" : "草稿"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
