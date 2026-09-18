import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type Article,
  type Category,
  fetchCategories,
  fetchIndex,
} from "../lib/content";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchIndex(), fetchCategories()])
      .then(([idx, c]) => {
        setArticles(idx.articles || []);
        setCats(c.categories || []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          <h1>稿件列表</h1>
          <p className="muted">QMD + 渲染 MD；可按分类筛选。</p>
        </div>
        <div className="row">
          <Link className="btn" to="/categories">
            稿件分类
          </Link>
          <Link className="btn" to="/new">
            手动新建
          </Link>
          <Link className="btn primary" to="/generate">
            AI 生成
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
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="muted">暂无稿件。先去选题风暴或 AI 生成。</p>
      )}

      <ul className="article-list">
        {filtered.map((a) => (
          <li key={a.id}>
            <Link to={`/article/${a.id}`}>
              <strong>{a.title}</strong>
              <span className="meta">
                <code>{a.id}</code>
                {a.categoryId ? ` · ${catName(a.categoryId)}` : ""}
                {a.promptId || a.styleId
                  ? ` · ${a.promptId || a.styleId}`
                  : ""}
                {a.qmd ? " · QMD" : ""}
                {a.md ? " · MD" : ""}
                {a.updatedAt ? ` · ${a.updatedAt.slice(0, 10)}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
