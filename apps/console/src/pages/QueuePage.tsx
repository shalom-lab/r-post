import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Article, fetchIndex } from "../lib/content";
import { dispatchDraftUpload, fetchQueueFile, moveInQueue, pendingItems, removeFromQueue } from "../lib/github-queue";
import { type WechatQueue, emptyQueue } from "../lib/wechat-queue";

export default function QueuePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [queue, setQueue] = useState<WechatQueue>(emptyQueue);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([fetchIndex(), fetchQueueFile()])
      .then(([index, record]) => {
        setArticles(index.articles);
        setQueue(record.queue);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const pending = pendingItems(queue);

  async function run(label: string, work: () => Promise<WechatQueue | void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const next = await work();
      if (next) setQueue(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败。");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="connection-page queue-page">
      <header>
        <span className="eyebrow">公众号</span>
        <h1>推文排期</h1>
        <p>顺序是上传先后。每两篇合成一期草稿，末尾剩一篇就单独一期。三篇挤一期太多。定时群发仍由你另外处理。</p>
      </header>

      {loading && <p className="reader-state">正在加载排期…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {notice && !error && <p className="reader-state ok">{notice}</p>}

      {!loading && !queue.items.length && (
        <p className="reader-state">还没有选定文章。回<Link to="/">主页</Link>点「加入排期」。</p>
      )}

      <ol className="queue-list">
        {queue.items.map((item, index) => {
          const article = byId.get(item.id);
          const pendingIndex = pending.findIndex((row) => row.id === item.id);
          const issueLabel = pendingIndex >= 0 ? `第${Math.floor(pendingIndex / 2) + 1}期` : null;
          return (
            <li key={item.id} className="queue-item">
              <span className="article-number">{index + 1}</span>
              <div>
                <h2>{article?.title || item.id}</h2>
                <p>{article?.description || "文章清单里暂时找不到这篇，可能尚未渲染。"}</p>
                <div className="article-meta">
                  {issueLabel && <span>{issueLabel}</span>}
                  <span>{item.status === "drafted" ? "已进草稿箱" : item.status === "error" ? "上次失败" : "待上传"}</span>
                  {item.mediaId && <span>media_id {item.mediaId.slice(0, 8)}…</span>}
                  {item.error && <span>{item.error}</span>}
                </div>
              </div>
              <div className="queue-item-actions">
                <button type="button" disabled={Boolean(busy) || index === 0} onClick={() => void run("move", () => moveInQueue(item.id, "up"))}>上移</button>
                <button type="button" disabled={Boolean(busy) || index === queue.items.length - 1} onClick={() => void run("move", () => moveInQueue(item.id, "down"))}>下移</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void run("remove", () => removeFromQueue(item.id, article?.title || item.id))}>移出</button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="queue-upload">
        <button
          type="button"
          disabled={Boolean(busy) || !pending.length}
          onClick={() => void run("upload", async () => {
            await dispatchDraftUpload();
            setNotice("已触发上传。会按顺序每两篇建一期草稿并写回 media_id；中控若在本机，请改用 npm run wechat:draft。");
          })}
        >
          {busy === "upload" ? "正在触发…" : `上传待发草稿（${pending.length}）`}
        </button>
        <p>浏览器只改排期文件。转换和微信接口在 Actions 或本地脚本里跑，不会把 AppSecret 放进网页。</p>
      </div>
    </section>
  );
}
