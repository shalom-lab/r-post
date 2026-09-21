import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchTopicsMarkdown } from "../lib/content";

export default function TopicsPage() {
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTopicsMarkdown().then(setMarkdown).catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <p className="reader-state error">{error}</p>;
  if (!markdown) return <p className="reader-state">正在加载选题…</p>;
  return (
    <section className="topics-reader">
      <header>
        <span className="eyebrow">TOPICS · 选题库</span>
        <h1>接下来，可以写什么？</h1>
        <p>所有候选选题、内容大纲和成稿状态都集中在一个 Markdown 文档中。</p>
      </header>
      <div className="topics-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown.replace(/^# .*\n/, "")}</ReactMarkdown>
      </div>
    </section>
  );
}
