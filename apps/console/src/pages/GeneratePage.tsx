import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  type Category,
  type PromptPack,
  fetchCategories,
  fetchPostRulesIndex,
} from "../lib/content";
import { dispatchGenerate, loadSettings } from "../lib/github";

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [slug, setSlug] = useState("");
  const [note, setNote] = useState("");
  const [topicId, setTopicId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [packs, setPacks] = useState<PromptPack[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPostRulesIndex(), fetchCategories()])
      .then(([rules, c]) => {
        setPacks((rules.packs || []).filter((p) => p.active !== false));
        setPromptId(rules.defaultPromptId || "");
        setCats(c.categories || []);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setRunUrl(null);
    setError(null);
    try {
      const url = await dispatchGenerate(loadSettings(), {
        topic,
        slug,
        note,
        promptId,
        topicId,
        categoryId,
      });
      setRunUrl(url);
      setStatus("已触发 Actions 生成。");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>写作</h1>
          <p className="muted">
            填写候选选题 ID 或自由主题，使用选定的写作 Prompt 生成 QMD。
          </p>
        </div>
        <Link className="btn" to="/topics">
          查看候选选题
        </Link>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label>
          选题 ID（与自由主题二选一）
          <input value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="topic-xxx" />
        </label>
        <label>
          自由主题
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="用 iris 做相关入门" />
        </label>

        <label>
          写作 Prompt
          <select
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
          >
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.id})
              </option>
            ))}
          </select>
        </label>
        <label>
          稿件分类（可选）
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">（跟选题或空）</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          slug（可选）
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label>
          补充说明（可选）
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy || (!topic.trim() && !topicId.trim())}>
          {busy ? "触发中…" : "触发 Actions"}
        </button>
      </form>

      {status && <p className="ok">{status}</p>}
      {runUrl && (
        <p className="ok">
          Actions：{" "}
          <a href={runUrl} target="_blank" rel="noreferrer">
            查看运行
          </a>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
