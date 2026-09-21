import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Article, fetchIndex } from "../lib/content";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchIndex()
      .then((index) => setArticles(index.articles.filter((article) => article.md)))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
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
      <section className="library-hero">
        <span className="eyebrow">RPOST · R 语言短教程</span>
        <h1>把一个问题，讲成一篇能运行的文章。</h1>
        <p>短、清楚、可复现。这里收录已经完成渲染的 R 教程。</p>
      </section>

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
          <Link className="article-card" to={`/article/${article.id}`} key={article.id}>
            <span className="article-number">{article.id}</span>
            <div>
              <h2>{article.title}</h2>
              <p>{article.description}</p>
              <div className="article-meta">
                {article.category && <span>{article.category}</span>}
                {article.date && <time>{article.date}</time>}
                {article.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            </div>
            <span className="article-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
