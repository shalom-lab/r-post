import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { type Article, fetchIndex } from "../lib/content";
import { dispatchDraftUpload, fetchDraftLog, fetchQueueFile, moveInQueue, removeFromQueue } from "../lib/github-queue";
import { emptyDraftLog, emptyQueue, type WechatDraftLog, type WechatQueue } from "../lib/wechat-queue";

export default function QueuePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [queue, setQueue] = useState<WechatQueue>(emptyQueue);
  const [draftLog, setDraftLog] = useState<WechatDraftLog>(emptyDraftLog);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([fetchIndex(), fetchQueueFile(), fetchDraftLog()])
      .then(([index, record, drafts]) => {
        setArticles(index.articles);
        setQueue(record.queue);
        setDraftLog(drafts);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles]);
  const history = useMemo(() => [...draftLog.drafts].reverse(), [draftLog]);

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
        <p>上面是待传名单。成功进微信草稿箱的记录只写在 wechat_draft.json，失败不记账。每两篇一期。</p>
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
          const issueLabel = `第${Math.floor(index / 2) + 1}期`;
          return (
            <li key={item.id} className="queue-item">
              <span className="article-number">{index + 1}</span>
              <div>
                <h2>{article?.title || item.id}</h2>
                <p>{article?.description || "文章清单里暂时找不到这篇，可能尚未渲染。"}</p>
                <div className="article-meta">
                  <span>{issueLabel}</span>
                  <span>待上传</span>
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
          disabled={Boolean(busy) || !queue.items.length}
          onClick={() => void run("upload", async () => {
            await dispatchDraftUpload();
            setNotice("已触发上传。成功后会写入 wechat_draft.json 并从排期名单里拿掉；中控若在本机，请改用 npm run wechat:draft。");
          })}
        >
          {busy === "upload" ? "正在触发…" : `上传待发草稿（${queue.items.length}）`}
        </button>
        <p>浏览器只改排期文件。转换和微信接口在 Actions 或本地脚本里跑，不会把 AppSecret 放进网页。</p>
      </div>

      {history.length > 0 && (
        <section className="draft-history">
          <h2>已上传草稿</h2>
          <ol className="queue-list">
            {history.map((draft) => (
              <li key={draft.mediaId} className="queue-item">
                <span className="article-number">稿</span>
                <div>
                  <h2>{(draft.titles.length ? draft.titles : draft.ids).join(" / ")}</h2>
                  <div className="article-meta">
                    {draft.uploadedAt && <span>{draft.uploadedAt.slice(0, 10)}</span>}
                    <span>media_id {draft.mediaId.slice(0, 10)}…</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
