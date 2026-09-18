import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { type Article, fetchIndex, fetchText } from "../lib/content";
import { publishToWeChat } from "../lib/wechatPublish";

type Tab = "split" | "md" | "qmd";

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [tab, setTab] = useState<Tab>("split");
  const [qmd, setQmd] = useState("");
  const [md, setMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const idx = await fetchIndex();
        const found = idx.articles.find((a) => a.id === id) || null;
        if (!found) throw new Error("找不到该稿件");
        if (cancelled) return;
        setArticle(found);
        const [q, m] = await Promise.all([
          found.qmd ? fetchText(found.qmd) : Promise.resolve(""),
          found.md ? fetchText(found.md) : Promise.resolve(""),
        ]);
        if (cancelled) return;
        setQmd(q);
        setMd(m);
        setTab(q && m ? "split" : m ? "md" : "qmd");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onPublish() {
    setMsg(null);
    try {
      await publishToWeChat(md);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
        <Link to="/">返回</Link>
      </section>
    );
  }

  if (!article) {
    return (
      <section className="panel">
        <p className="muted">加载中…</p>
      </section>
    );
  }

  const showQmd = tab === "qmd" || tab === "split";
  const showMd = tab === "md" || tab === "split";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <Link className="back" to="/">
            ← 稿件
          </Link>
          <h1>{article.title}</h1>
          <p className="muted">
            <code>{article.id}</code>
          </p>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={onPublish} disabled={!md}>
            发布公众号（预留）
          </button>
        </div>
      </div>

      {msg && <p className="muted">{msg}</p>}

      <div className="tabs">
        <button
          type="button"
          className={tab === "split" ? "active" : ""}
          onClick={() => setTab("split")}
        >
          双栏
        </button>
        <button
          type="button"
          className={tab === "md" ? "active" : ""}
          onClick={() => setTab("md")}
        >
          仅 MD
        </button>
        <button
          type="button"
          className={tab === "qmd" ? "active" : ""}
          onClick={() => setTab("qmd")}
        >
          仅 QMD
        </button>
      </div>

      <div className={tab === "split" ? "dual-pane" : "single-pane"}>
        {showQmd && (
          <div className="pane">
            <h2 className="pane-title">QMD 源码</h2>
            <pre className="code-block">{qmd || "暂无 QMD"}</pre>
          </div>
        )}
        {showMd && (
          <div className="pane">
            <h2 className="pane-title">Markdown 预览</h2>
            <article className="md-body">
              {md ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
              ) : (
                <p className="muted">尚无渲染 MD（等 Actions Quarto 完成）。</p>
              )}
            </article>
          </div>
        )}
      </div>
    </section>
  );
}
