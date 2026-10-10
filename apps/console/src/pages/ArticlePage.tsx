import { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import {
  CONTENT_INDEX_CACHE_KEY,
  contentBodyCacheKey,
  type Article,
  fetchContent,
  fetchIndex,
} from "../lib/content";
import { CACHE_UPDATED } from "../lib/local-cache";
import "../../../../wechat/custom-md-css/default.css";

/** Old serial article ids → new YYYYMMDD-slug folder ids (keep old links alive). */
const LEGACY_ARTICLE_REDIRECTS: Record<string, string> = {
  "002": "20260921-r-save-five-methods",
  "003": "20260921-regex-real-world",
  "004": "20260927-batch-read-without-for",
  "005": "20260927-regex-extract-data",
};

function withoutFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

/** Quarto 嵌图是 data:image；react-markdown 默认只放行 http(s) 等，会把图 src 清掉。 */
function articleUrlTransform(url: string) {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(url)) return url;
  return defaultUrlTransform(url);
}

export default function ArticlePage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wantMd = searchParams.get("view") === "md";
  const legacyTarget = rawId ? LEGACY_ARTICLE_REDIRECTS[rawId] : undefined;
  const id = legacyTarget || rawId;

  const [article, setArticle] = useState<Article | null>(null);
  const [qmdText, setQmdText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [hasMd, setHasMd] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id || legacyTarget) return;
    let cancelled = false;
    let watchedKeys = new Set<string>([CONTENT_INDEX_CACHE_KEY]);

    async function loadArticle() {
      try {
        const index = await fetchIndex();
        const found = index.articles.find((item) => item.id === id);
        if (!found?.qmd) throw new Error("找不到这篇文章的 QMD");

        watchedKeys = new Set([CONTENT_INDEX_CACHE_KEY, contentBodyCacheKey(found.qmd)]);
        if (found.md) watchedKeys.add(contentBodyCacheKey(found.md));

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
    }

    void loadArticle();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && watchedKeys.has(key)) void loadArticle();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
    };
  }, [id, legacyTarget]);

  useEffect(() => {
    if (!article) return;
    if (wantMd && !hasMd) {
      navigate(`/article/${article.id}`, { replace: true });
    }
  }, [article, wantMd, hasMd, navigate]);

  useEffect(() => {
    if (!article) return;
    const prev = document.title;
    document.title = article.date
      ? `${article.date} · ${article.title}`
      : article.title;
    return () => { document.title = prev; };
  }, [article]);

  if (legacyTarget) {
    const search = searchParams.toString();
    return (
      <Navigate
        to={search ? `/article/${legacyTarget}?${search}` : `/article/${legacyTarget}`}
        replace
      />
    );
  }

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
      <header className="article-toolbar">
        <div className="article-meta">
          <span className="article-number">{article.date || article.id}</span>
          {article.category && <span>{article.category}</span>}
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
          <div id="markmuse" className="article-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={articleUrlTransform}>
              {markdown}
            </ReactMarkdown>
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
