import { useEffect, useState } from "react";
import {
  type Category,
  fetchCategories,
  type CategoriesFile,
} from "../lib/content";
import {
  loadSettings,
  readRepoJson,
  saveCategories,
  type CategoriesPayload,
} from "../lib/github";

export default function CategoriesPage() {
  const [file, setFile] = useState<CategoriesFile | null>(null);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then(setFile)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function persist(next: CategoriesPayload, message: string) {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const settings = loadSettings();
      await saveCategories(settings, next, message);
      setFile(next);
      setMsg("已写回 content/categories.json");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const live =
      (await readRepoJson<CategoriesPayload>(
        loadSettings(),
        "content/categories.json",
      )) ||
      file ||
      { categories: [] };
    if (!/^[a-z0-9-]+$/.test(id.trim())) {
      setError("id 仅允许小写字母、数字、短横线");
      return;
    }
    const categories = [
      ...live.categories.filter((c) => c.id !== id.trim()),
      {
        id: id.trim(),
        name: name.trim() || id.trim(),
        order: live.categories.length + 1,
      },
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    await persist({ categories }, `categories: add ${id.trim()}`);
    setId("");
    setName("");
  }

  async function onRemove(cat: Category) {
    if (!window.confirm(`移除分类 ${cat.name}？稿件上的 categoryId 不会自动清空。`)) {
      return;
    }
    const live =
      (await readRepoJson<CategoriesPayload>(
        loadSettings(),
        "content/categories.json",
      )) ||
      file ||
      { categories: [] };
    await persist(
      { categories: live.categories.filter((c) => c.id !== cat.id) },
      `categories: remove ${cat.id}`,
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>分类</h1>
          <p className="muted">
            稿件与选题共用 <code>categoryId</code>（单分类）。管理{" "}
            <code>content/categories.json</code>。
          </p>
        </div>
      </div>

      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <ul className="article-list">
        {(file?.categories || []).map((c) => (
          <li key={c.id} className="row between">
            <div>
              <strong>{c.name}</strong>
              <span className="meta">
                <code>{c.id}</code>
              </span>
            </div>
            <button type="button" className="btn" disabled={busy} onClick={() => onRemove(c)}>
              移除
            </button>
          </li>
        ))}
      </ul>

      <form className="form" onSubmit={onAdd}>
        <h2>新增分类</h2>
        <label>
          id
          <input value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label>
          名称
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          添加
        </button>
      </form>
    </section>
  );
}
