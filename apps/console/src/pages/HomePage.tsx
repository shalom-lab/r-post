import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CONTENT_INDEX_CACHE_KEY, type Article, fetchIndex } from "../lib/content";
import { CACHE_UPDATED } from "../lib/local-cache";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadArticles() {
      try {
        const index = await fetchIndex();
        if (!cancelled) {
          setArticles(index.articles.filter((article) => article.qmd));
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法加载文章。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadArticles();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key === CONTENT_INDEX_CACHE_KEY) void loadArticles();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    for (const article of articles) {
      if (article.category) unique.set(article.categorySlug || article.category, article.category);
    }
    return [...unique.entries()];
  }, [articles]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category && (article.categorySlug || article.category) !== category) return false;
      if (!keyword) return true;
      return [article.title, article.description, article.category, ...article.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [articles, category, query]);

  return (
    <>
      <section className="library-tools" aria-label="文章筛选">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、内容或标签…"
          aria-label="搜索文章"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="按分类筛选"
        >
          <option value="">全部分类</option>
          {categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
        </select>
      </section>

      {loading && <p className="reader-state">正在加载文章…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {!loading && !error && !visible.length && (
        <p className="reader-state">没有匹配的文章。</p>
      )}

      <div className="article-list">
        {visible.map((article) => (
          <div className="article-card" key={article.id}>
            <Link className="article-card-main" to={`/article/${article.id}`}>
              <span className="article-number">{article.date || article.id}</span>
              <div>
                <h2>{article.title}</h2>
                <p>{article.description}</p>
                <div className="article-meta">
                  {article.category && <span>{article.category}</span>}
                  {article.md ? <span className="source-badge soft">已渲染 MD</span> : <span className="source-muted">仅 QMD</span>}
                  {article.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
