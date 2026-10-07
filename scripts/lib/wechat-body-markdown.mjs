/**
 * 把已渲染 Markdown 收成微信草稿正文：
 * 去掉 frontmatter、一级标题，以及标题下 Quarto 留下的作者/日期行
 *（微信草稿自带署名与日期，正文开头重复会冲突）。
 */
export function bodyMarkdown(markdown) {
  let text = String(markdown || "")
    .replace(/^\uFEFF/, "")
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  text = text.replace(/^#\s+[^\n]+\n+/, "");
  // 常见形态：RPost\n2026-09-21\n
  text = text.replace(/^RPost\s*\r?\n\d{4}-\d{2}-\d{2}\s*\r?\n+/, "");
  // 若只剩日期行，同样去掉
  text = text.replace(/^\d{4}-\d{2}-\d{2}\s*\r?\n+/, "");
  return `${text.trim()}\n`;
}
