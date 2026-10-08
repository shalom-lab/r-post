import { cachedFetchText } from "./local-cache";

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

export const CONTENT_INDEX_CACHE_KEY = "content/index.json";

export function contentBodyCacheKey(relativePath: string): string {
  return `content/${relativePath.replace(/^\//, "")}`;
}

export function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${relativePath.replace(/^\//, "")}`
    .replace(/\/{2,}/g, "/")
    .replace(":/", "://");
}

export async function fetchIndex(): Promise<ContentIndex> {
  const text = await cachedFetchText(
    CONTENT_INDEX_CACHE_KEY,
    assetUrl("content/index.json"),
    {
      metaFromBody: (body) => {
        try {
          return String((JSON.parse(body) as ContentIndex).updatedAt || "");
        } catch {
          return "";
        }
      },
    },
  );
  return JSON.parse(text) as ContentIndex;
}

export async function fetchContent(relativePath: string): Promise<string> {
  const key = contentBodyCacheKey(relativePath);
  return cachedFetchText(key, assetUrl(`content/${relativePath}`));
}
