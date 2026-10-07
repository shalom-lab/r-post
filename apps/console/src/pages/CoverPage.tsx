import { useEffect, useState } from "react";
import { coverImageUrl, fetchCovers, type CoverItem } from "../lib/covers";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function formatRatio(width: number, height: number): string {
  if (!width || !height) return "—";
  const g = gcd(width, height);
  const a = width / g;
  const b = height / g;
  if (a <= 100 && b <= 100) return `${a}:${b}`;
  return `${(width / height).toFixed(2)}:1`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

type Preview = { src: string; title: string };

function CoverCard({
  item,
  onPreview,
}: {
  item: CoverItem;
  onPreview: (preview: Preview | null) => void;
}) {
  const [copied, setCopied] = useState<"id" | "title" | "">("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
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
      <div
        className="cover-card-media"
        onMouseEnter={() => {
          if (src) onPreview({ src, title: item.title });
        }}
        onMouseLeave={() => onPreview(null)}
      >
        {src ? (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            onLoad={(event) => {
              const img = event.currentTarget;
              setSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        ) : (
          <div className="cover-card-empty">尚无封面图</div>
        )}
      </div>
      <div className="cover-card-body">
        <code className="cover-id" title={item.id}>{item.id}</code>
        <h2 title={item.title}>{item.title}</h2>
        <div className="cover-card-actions">
          <button type="button" onClick={() => void copy("id", item.id)}>
            {copied === "id" ? "已复制" : "复制 id"}
          </button>
          <button type="button" onClick={() => void copy("title", item.title)}>
            {copied === "title" ? "已复制" : "复制标题"}
          </button>
        </div>
        <p className="cover-card-meta">
          {size
            ? `长宽比 ${formatRatio(size.w, size.h)} · ${size.w}×${size.h}`
            : src
              ? "尺寸读取中…"
              : "无图"}
        </p>
      </div>
    </article>
  );
}

export default function CoverPage() {
  const [covers, setCovers] = useState<CoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

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
          对照 <code>cover/cover.json</code> 看全部封面。悬停小图看大图；点按钮复制 <code>id</code> 或标题。
          {covers.length > 0 && ` 合计 ${covers.length} · 已启用 ${ready}。`}
        </p>
      </header>

      {loading && <p className="reader-state">正在加载封面…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {!loading && !error && !covers.length && <p className="reader-state">封面清单是空的。</p>}

      <div className="cover-grid">
        {covers.map((item) => (
          <CoverCard key={item.id} item={item} onPreview={setPreview} />
        ))}
      </div>

      {preview && (
        <div className="cover-hover-preview" aria-hidden="true">
          <img src={preview.src} alt="" />
          <p>{preview.title}</p>
        </div>
      )}
    </section>
  );
}
