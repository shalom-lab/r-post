import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { type Article, fetchIndex, fetchText } from "../lib/content";
import { publishToWeChat } from "../lib/wechatPublish";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5C14.3 5.1 11.5 3 8 3zm0 8.2A3.2 3.2 0 1 1 8 4.8a3.2 3.2 0 0 1 0 6.4zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M13.4 11.1 11.2 8.9A3.2 3.2 0 0 0 7.1 4.8L5.4 3.1C6.2 2.9 7.1 2.8 8 2.8c3.5 0 6.3 2.1 7.5 5-.5 1.2-1.3 2.2-2.3 3-.2.1-.5.2-.8.3zM1.5 2.1l1.5 1.5C2 4.5 1.1 5.7.5 7.8c1.2 2.9 4 5 7.5 5 1.1 0 2.1-.2 3.1-.6l2.4 2.4.9-.9L2.4 1.2l-.9.9zm4.3 4.3 2.4 2.4a2 2 0 0 1-2.4-2.4zm1.5 4.7c-.4 0-.8-.1-1.1-.2l1.5 1.5c.4.1.8.1 1.2.1a3.2 3.2 0 0 0 3.1-2.5l-1.6-1.6a2 2 0 0 1-3.1 2.7z" />
    </svg>
  );
}

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [showQmd, setShowQmd] = useState(true);
  const [showMd, setShowMd] = useState(true);
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
        setShowQmd(Boolean(q));
        setShowMd(Boolean(m) || !q);
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

  const paneCount = (showQmd ? 1 : 0) + (showMd ? 1 : 0);

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
          <button
            type="button"
            className={`btn eye-btn ${showQmd ? "is-on" : ""}`}
            onClick={() => setShowQmd((v) => !v)}
            title={showQmd ? "隐藏 QMD" : "显示 QMD"}
          >
            <EyeIcon open={showQmd} />
            QMD
          </button>
          <button
            type="button"
            className={`btn eye-btn ${showMd ? "is-on" : ""}`}
            onClick={() => setShowMd((v) => !v)}
            title={showMd ? "隐藏 MD" : "显示 MD"}
          >
            <EyeIcon open={showMd} />
            MD
          </button>
          <button type="button" className="btn" onClick={onPublish} disabled={!md}>
            发布公众号（预留）
          </button>
        </div>
      </div>

      {msg && <p className="muted">{msg}</p>}

      {paneCount === 0 ? (
        <p className="muted">两栏都已隐藏，点上方眼睛图标重新显示。</p>
      ) : (
        <div className={paneCount > 1 ? "dual-pane" : "single-pane"}>
          {showQmd && (
            <div className="pane">
              <div className="pane-bar">
                <h2 className="pane-title">QMD 源码</h2>
                <button
                  type="button"
                  className="btn icon-only"
                  onClick={() => setShowQmd(false)}
                  title="隐藏"
                >
                  <EyeIcon open />
                </button>
              </div>
              <pre className="code-block">{qmd || "暂无 QMD"}</pre>
            </div>
          )}
          {showMd && (
            <div className="pane">
              <div className="pane-bar">
                <h2 className="pane-title">Markdown 预览</h2>
                <button
                  type="button"
                  className="btn icon-only"
                  onClick={() => setShowMd(false)}
                  title="隐藏"
                >
                  <EyeIcon open />
                </button>
              </div>
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
      )}
    </section>
  );
}
