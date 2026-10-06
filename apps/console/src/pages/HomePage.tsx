import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Article, fetchIndex } from "../lib/content";
import { addToQueue, fetchQueueFile, removeFromQueue } from "../lib/github-queue";
import { type WechatQueue, emptyQueue } from "../lib/wechat-queue";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [queue, setQueue] = useState<WechatQueue>(emptyQueue);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const index = await fetchIndex();
        if (!cancelled) setArticles(index.articles.filter((article) => article.qmd));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法加载文章。");
      }
      try {
        const record = await fetchQueueFile();
        if (!cancelled) setQueue(record.queue);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法读取排期。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const queued = useMemo(() => new Map(queue.items.map((item) => [item.id, item])), [queue]);

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

  async function toggleQueue(article: Article) {
    setBusyId(article.id);
    setError("");
    setNotice("");
    try {
      const next = queued.has(article.id)
        ? await removeFromQueue(article.id, article.title)
        : await addToQueue(article.id, article.title);
      setQueue(next);
      setNotice(queued.has(article.id) ? `已移出排期：${article.title}` : `已加入排期：${article.title}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存排期失败。");
    } finally {
      setBusyId("");
    }
  }

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
        <Link className="queue-entry" to="/queue">排期 {queue.items.length}</Link>
      </section>

      {loading && <p className="reader-state">正在加载文章…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {notice && !error && <p className="reader-state ok">{notice}</p>}
      {!loading && !error && !visible.length && (
        <p className="reader-state">没有匹配的文章。</p>
      )}

      <div className="article-list">
        {visible.map((article) => {
          const queuedItem = queued.get(article.id);
          const canQueue = Boolean(article.md);
          return (
            <div className="article-card" key={article.id}>
              <Link className="article-card-main" to={`/article/${article.id}`}>
                <span className="article-number">{article.date || article.id}</span>
                <div>
                  <h2>{article.title}</h2>
                  <p>{article.description}</p>
                  <div className="article-meta">
                    {article.category && <span>{article.category}</span>}
                    {article.md ? <span className="source-badge soft">已渲染 MD</span> : <span className="source-muted">仅 QMD</span>}
                    {queuedItem?.status === "drafted" && <span className="source-badge">已进草稿箱</span>}
                    {queuedItem?.status === "queued" && <span className="source-badge soft">排期中</span>}
                    {queuedItem?.status === "error" && <span className="source-muted">上次上传失败</span>}
                    {article.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                className={queuedItem ? "queue-toggle in" : "queue-toggle"}
                disabled={Boolean(busyId) || (!canQueue && !queuedItem)}
                title={!canQueue && !queuedItem ? "需要先渲染出 Markdown" : undefined}
                onClick={() => void toggleQueue(article)}
              >
                {busyId === article.id ? "保存中…" : queuedItem ? "移出排期" : "加入排期"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
