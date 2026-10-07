import { useEffect, useState } from "react";
import { coverImageUrl, fetchCovers, type CoverItem } from "../lib/covers";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function CoverCard({ item }: { item: CoverItem }) {
  const [copied, setCopied] = useState<"id" | "title" | "">("");
  const src = coverImageUrl(item.image);

  async function copy(kind: "id" | "title", text: string) {
    try {
      await copyText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  return (
    <article className={`cover-card${!item.active || !src ? " pending" : ""}`}>
      <div className="cover-card-media">
        {src ? (
          <img src={src} alt={item.title} loading="lazy" />
        ) : (
          <div className="cover-card-empty">尚无封面图</div>
        )}
      </div>
      <div className="cover-card-body">
        <div className="article-meta">
          {item.active && src ? <span className="source-badge">已启用</span> : <span className="source-badge soft">待制作</span>}
          <code className="cover-id">{item.id}</code>
        </div>
        <h2>{item.title}</h2>
        <div className="cover-card-actions">
          <button type="button" onClick={() => void copy("id", item.id)}>
            {copied === "id" ? "已复制 id" : "复制 id"}
          </button>
          <button type="button" onClick={() => void copy("title", item.title)}>
            {copied === "title" ? "已复制标题" : "复制标题"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CoverPage() {
  const [covers, setCovers] = useState<CoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCovers()
      .then((index) => setCovers(index.covers))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const ready = covers.filter((c) => c.active && c.image).length;

  return (
    <section className="cover-page">
      <header>
        <span className="eyebrow">公众号</span>
        <h1>封面预览</h1>
        <p>
          对照 <code>cover/cover.json</code> 看全部封面。点按钮复制 <code>id</code> 或标题。
          {covers.length > 0 && ` 合计 ${covers.length} · 已启用 ${ready}。`}
        </p>
      </header>

      {loading && <p className="reader-state">正在加载封面…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {!loading && !error && !covers.length && <p className="reader-state">封面清单是空的。</p>}

      <div className="cover-grid">
        {covers.map((item) => (
          <CoverCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
