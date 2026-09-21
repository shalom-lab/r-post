import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { type Article, fetchContent, fetchIndex } from "../lib/content";

function withoutFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const index = await fetchIndex();
        const found = index.articles.find((item) => item.id === id);
        if (!found?.md) throw new Error("这篇文章还没有完成渲染");
        const body = await fetchContent(found.md);
        if (!cancelled) {
          setArticle(found);
          setMarkdown(withoutFrontmatter(body));
        }
      } catch (reason) {
        if (!cancelled) setError((reason as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return <div className="reader-state error"><p>{error}</p><Link to="/">返回文章列表</Link></div>;
  }
  if (!article) return <p className="reader-state">正在加载文章…</p>;

  const sourceUrl = `https://github.com/shalom-lab/r-post/blob/master/content/${article.qmd}`;
  return (
    <article className="reader-article">
      <Link className="reader-back" to="/">← 返回文章列表</Link>
      <header className="article-header">
        <span className="article-number">{article.id}</span>
        <h1>{article.title}</h1>
        {article.description && <p>{article.description}</p>}
        <div className="article-meta">
          {article.category && <span>{article.category}</span>}
          {article.date && <time>{article.date}</time>}
          <a href={sourceUrl} target="_blank" rel="noreferrer">查看 QMD 源文件 ↗</a>
        </div>
      </header>
      <div className="article-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
