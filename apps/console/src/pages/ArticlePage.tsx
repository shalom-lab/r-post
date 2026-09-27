import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { type Article, fetchContent, fetchIndex } from "../lib/content";

function withoutFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

export default function ArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wantMd = searchParams.get("view") === "md";

  const [article, setArticle] = useState<Article | null>(null);
  const [qmdText, setQmdText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [hasMd, setHasMd] = useState(false);
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
        let mdOk = false;
        if (found.md) {
          try {
            mdBody = withoutFrontmatter(await fetchContent(found.md));
            mdOk = Boolean(mdBody.trim());
          } catch {
            mdOk = false;
          }
        }

        if (!cancelled) {
          setArticle(found);
          setQmdText(qmdBody);
          setMarkdown(mdBody);
          setHasMd(mdOk);
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

  useEffect(() => {
    if (!article) return;
    if (wantMd && !hasMd) {
      navigate(`/article/${article.id}`, { replace: true });
    }
  }, [article, wantMd, hasMd, navigate]);

  if (error) {
    return (
      <div className="reader-state error">
        <p>{error}</p>
        <Link to="/">返回文章列表</Link>
      </div>
    );
  }
  if (!article) return <p className="reader-state">正在加载文章…</p>;

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
        </div>
        <div className="view-toggle" role="tablist" aria-label="源稿与渲染">
          <Link
            className={`view-tab${!showMd ? " active" : ""}`}
            to={`/article/${article.id}`}
            role="tab"
            aria-selected={!showMd}
          >
            QMD
          </Link>
          {hasMd ? (
            <Link
              className={`view-tab${showMd ? " active" : ""}`}
              to={`/article/${article.id}?view=md`}
              role="tab"
              aria-selected={showMd}
            >
              MD
            </Link>
          ) : (
            <span className="view-tab disabled" role="tab" aria-disabled="true" title="尚未渲染">
              MD
            </span>
          )}
        </div>
      </header>

      <section className="content-card" aria-label={showMd ? "已渲染 Markdown" : "原始 QMD"}>
        {showMd ? (
          <div className="article-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : (
          <pre className="qmd-source">
            <code>{qmdText}</code>
          </pre>
        )}
      </section>
    </article>
  );
}
