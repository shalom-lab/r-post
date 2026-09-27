import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { type Article, fetchContent, fetchIndex } from "../lib/content";

function withoutFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

export default function ArticlePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const wantMd = searchParams.get("view") === "md";

  const [article, setArticle] = useState<Article | null>(null);
  const [qmdText, setQmdText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const index = await fetchIndex();
        const found = index.articles.find((item) => item.id === id);
        if (!found?.qmd) throw new Error("找不到这篇文章的 QMD");

        const qmdBody = await fetchContent(found.qmd);
        let mdBody = "";
        if (found.md) {
          try {
            mdBody = withoutFrontmatter(await fetchContent(found.md));
          } catch {
            // index 说有 md，但文件没同步到站点时，当作未渲染
            found.md = null;
          }
        }

        if (!cancelled) {
          setArticle(found);
          setQmdText(qmdBody);
          setMarkdown(mdBody);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError((reason as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="reader-state error">
        <p>{error}</p>
        <Link to="/">返回文章列表</Link>
      </div>
    );
  }
  if (!article) return <p className="reader-state">正在加载文章…</p>;

  const hasMd = Boolean(article.md && markdown);
  const showMd = wantMd && hasMd;

  return (
    <article className="reader-article">
      <Link className="reader-back" to="/">
        ← 返回文章列表
      </Link>
      <header className="article-header">
        <span className="article-number">{article.id}</span>
        <h1>{article.title}</h1>
        {article.description && <p>{article.description}</p>}
        <div className="article-meta">
          {article.category && <span>{article.category}</span>}
          {article.date && <time>{article.date}</time>}
          <span className="source-badge">原始 QMD</span>
          {hasMd ? (
            showMd ? (
              <Link to={`/article/${article.id}`}>看原始 QMD</Link>
            ) : (
              <Link to={`/article/${article.id}?view=md`}>查看已渲染 Markdown</Link>
            )
          ) : (
            <span className="source-muted">尚未渲染 Markdown</span>
          )}
        </div>
      </header>

      {showMd ? (
        <div className="article-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <section className="qmd-panel" aria-label="原始 QMD">
          <div className="qmd-panel-label">QMD 源稿（未渲染）</div>
          <pre className="qmd-source">
            <code>{qmdText}</code>
          </pre>
        </section>
      )}
    </article>
  );
}
