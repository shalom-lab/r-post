import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type Category, fetchCategories } from "../lib/content";
import {
  loadSettings,
  putRepoFile,
  upsertArticleInIndex,
} from "../lib/github";

function slugify(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (ascii.length >= 2) return ascii;
  const d = new Date();
  return `draft-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildQmd(title: string, summary: string, body: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    'author: "RPost"',
    `date: "${date}"`,
    "format: gfm",
    "---",
    "",
  ];
  if (summary.trim()) {
    parts.push(summary.trim(), "");
  }
  parts.push(body.trim() || "（正文待写）", "");
  return parts.join("\n");
}

export default function NewDraftPage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [body, setBody] = useState(
    "## 场景\n\n一句话说明要做什么。\n\n## 代码\n\n```{r}\n# 用真实数据，例如 mtcars / iris\n```\n\n## 小结\n\n带走一句。\n",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((c) => setCats(c.categories || []))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const settings = loadSettings();
      const id = (slug.trim() || slugify(title)).replace(/^-+|-+$/g, "");
      if (!title.trim()) throw new Error("标题不能为空");
      if (!id) throw new Error("slug 无效");

      const qmd = buildQmd(title.trim(), summary, body);
      const qmdPath = `content/drafts/${id}.qmd`;
      await putRepoFile(settings, {
        path: qmdPath,
        content: qmd,
        message: `content: manual draft ${id}`,
      });
      await upsertArticleInIndex(settings, {
        id,
        title: title.trim(),
        categoryId: categoryId || null,
        styleId: null,
        topicId: null,
        qmd: `drafts/${id}.qmd`,
        md: null,
        updatedAt: new Date().toISOString(),
      });
      setStatus(`已写入仓库 ${qmdPath}。`);
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
          <h1>手动新建</h1>
          <p className="muted">
            写标题 / 摘要 / 正文，经 PAT 提交到 <code>content/drafts/</code>。
          </p>
        </div>
        <Link className="btn" to="/generate">
          改用 AI 生成
        </Link>
      </div>

      <form className="form form-wide" onSubmit={onSubmit}>
        <label>
          标题
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          分类
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">（不指定）</option>
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
          摘要
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
          />
        </label>
        <label>
          正文（QMD）
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="mono"
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "提交中…" : "提交到仓库"}
        </button>
      </form>

      {status && <p className="ok">{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
