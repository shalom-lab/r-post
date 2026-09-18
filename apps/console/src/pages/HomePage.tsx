import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type Article,
  type Category,
  type ContentIndex,
  fetchCategories,
  fetchIndex,
} from "../lib/content";
import { loadSettings, readRepoJson } from "../lib/github";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function applyIndex(idx: ContentIndex, c: { categories?: Category[] }) {
    setArticles(idx.articles || []);
    setCats(c.categories || []);
  }

  useEffect(() => {
    Promise.all([fetchIndex(), fetchCategories()])
      .then(([idx, c]) => applyIndex(idx, c))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function pullFromRepo() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const settings = loadSettings();
      const [idx, catsFile] = await Promise.all([
        readRepoJson<ContentIndex>(settings, "content/index.json"),
        readRepoJson<{ categories?: Category[] }>(
          settings,
          "content/categories.json",
        ),
      ]);
      if (!idx) throw new Error("仓库中没有 content/index.json");
      applyIndex(idx, catsFile || { categories: cats });
      setMsg("已从仓库拉取最新稿件索引");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const catName = useMemo(() => {
    const m = new Map(cats.map((c) => [c.id, c.name]));
    return (id?: string | null) => (id ? m.get(id) || id : "");
  }, [cats]);

  const filtered = useMemo(() => {
    if (!categoryId) return articles;
    return articles.filter((a) => a.categoryId === categoryId);
  }, [articles, categoryId]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>稿件</h1>
          <p className="muted">按分类筛选；点标题打开预览。</p>
        </div>
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={pullFromRepo}>
            拉取
          </button>
          <Link className="btn" to="/categories">
            分类
          </Link>
          <Link className="btn" to="/new">
            新建
          </Link>
          <Link className="btn primary" to="/generate">
            写作
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">全部分类</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">加载中…</p>}
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="muted">暂无稿件。先去选题或写作。</p>
      )}

      {filtered.length > 0 && (
        <ul className="simple-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link to={`/article/${a.id}`} className="simple-row">
                <div className="simple-main">
                  <strong>{a.title}</strong>
                  <span className="meta">
                    <code>{a.id}</code>
                    {a.categoryId ? ` · ${catName(a.categoryId)}` : ""}
                    {a.promptId || a.styleId
                      ? ` · ${a.promptId || a.styleId}`
                      : ""}
                    {a.updatedAt ? ` · ${a.updatedAt.slice(0, 10)}` : ""}
                  </span>
                </div>
                <span className="chip-row">
                  {a.qmd && <span className="chip">QMD</span>}
                  {a.md && <span className="chip chip-ok">MD</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
