export default function OutlineView({ outline }: { outline: Record<string, unknown> | null | undefined }) {
  if (!outline) return <p className="muted">还没有大纲。可以编辑选题，或使用选题工作流补充大纲。</p>;
  const sections = Array.isArray(outline.sections) ? outline.sections : [];
  return <div className="outline-readable">
    {outline.workingTitle ? <h3>{String(outline.workingTitle)}</h3> : null}
    {outline.hook ? <p>{String(outline.hook)}</p> : null}
    {outline.dataset ? <p className="dataset-note"><b>使用数据</b> {String(outline.dataset)}</p> : null}
    <ol>{sections.map((section, i) => {
      const s = section as { heading?: string; point?: string; points?: string[] };
      return <li key={i}><strong>{s.heading || `第 ${i + 1} 节`}</strong>
        {s.point && <p>{s.point}</p>}
        {Array.isArray(s.points) && <ul>{s.points.map((p,j)=><li key={j}>{p}</li>)}</ul>}
      </li>;
    })}</ol>
    {outline.takeaway ? <p><b>读者带走</b> {String(outline.takeaway)}</p> : null}
    {outline.risks ? <p className="muted">注意：{String(outline.risks)}</p> : null}
  </div>;
}
