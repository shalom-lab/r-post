export function validateTopics(rows, quota, existing = [], categoryIds = []) {
  if (!Number.isInteger(quota) || quota < 1 || quota > 20) throw new Error("quota must be an integer from 1 to 20");
  if (!Array.isArray(rows) || rows.length !== quota) throw new Error("AI must return exactly the requested number of topics");
  const seen = new Set(existing.map(x => x.title.trim().toLowerCase()));
  for (const row of rows) {
    if (!row || typeof row.title !== "string" || !row.title.trim()) throw new Error("Topic title is required");
    const key = row.title.trim().toLowerCase();
    if (seen.has(key)) throw new Error("Duplicate topic: " + row.title);
    seen.add(key);
    if (typeof row.blurb !== "string" || !row.blurb.trim()) throw new Error("Topic summary is required");
    if (row.categoryId && !categoryIds.includes(row.categoryId)) throw new Error("Unknown category");
    const o = row.outline;
    if (!o || typeof o.dataset !== "string" || !o.dataset.trim() || typeof o.workingTitle !== "string" || !o.workingTitle.trim()) throw new Error("Outline needs a title and dataset");
    if (!Array.isArray(o.sections) || o.sections.length < 3 || o.sections.length > 5) throw new Error("Outline must contain 3 to 5 sections");
    if (o.sections.some(s => !s || typeof s.heading !== "string" || !s.heading.trim() || typeof s.point !== "string" || !s.point.trim())) throw new Error("Outline sections need heading and point");
  }
  return rows;
}
