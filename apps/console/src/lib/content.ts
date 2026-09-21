export type Article = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  categorySlug: string;
  tags: string[];
  qmd: string;
  md: string | null;
};

export type ContentIndex = {
  articles: Article[];
  updatedAt: string;
};

export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${relativePath.replace(/^\//, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(":/", "://");
}

export async function fetchIndex(): Promise<ContentIndex> {
  const response = await fetch(assetUrl("content/index.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(`无法加载文章清单（${response.status}）`);
  return response.json() as Promise<ContentIndex>;
}

export async function fetchContent(relativePath: string): Promise<string> {
  const response = await fetch(assetUrl(`content/${relativePath}`), { cache: "no-store" });
  if (!response.ok) throw new Error(`无法加载文章（${response.status}）`);
  return response.text();
}

export async function fetchTopicsMarkdown(): Promise<string> {
  const response = await fetch(assetUrl("topics/index.md"), { cache: "no-store" });
  if (!response.ok) throw new Error(`无法加载选题文档（${response.status}）`);
  return response.text();
}
