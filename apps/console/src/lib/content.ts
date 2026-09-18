export type Article = {
  id: string;
  title: string;
  categoryId?: string | null;
  promptId?: string | null;
  /** @deprecated 读作 promptId */
  styleId?: string | null;
  topicId?: string | null;
  qmd: string | null;
  md: string | null;
  updatedAt: string;
};

export type ContentIndex = {
  articles: Article[];
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  order?: number;
};

export type CategoriesFile = {
  categories: Category[];
  updatedAt?: string;
};

export type PromptPack = {
  id: string;
  title: string;
  /** 相对 prompt-rules/ 的文件名，如 topic_prompt_default.md */
  file: string;
  description?: string;
  active?: boolean;
  updatedAt?: string;
};

export type PromptSection = {
  defaultPromptId: string;
  packs: PromptPack[];
};

/** prompt-rules/index.json */
export type PromptRulesIndex = {
  topic: PromptSection;
  post: PromptSection;
  updatedAt?: string;
};

export type TopicItem = {
  id: string;
  title: string;
  blurb?: string;
  categoryId?: string | null;
  angle?: string | null;
  scheduled: boolean;
  outline?: Record<string, unknown> | null;
  outlinedAt?: string | null;
  articleId?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type TopicsFile = {
  meta: {
    dailyQuota: number;
    topicPromptId?: string;
    lastIdeatedAt?: string | null;
  };
  items: TopicItem[];
  updatedAt?: string;
};

export function assetUrl(rel: string): string {
  const cleaned = rel.replace(/^\//, "");
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${cleaned}`.replace(/\/{2,}/g, "/").replace(":/", "://");
}

async function fetchJson<T>(rel: string): Promise<T> {
  const res = await fetch(assetUrl(rel), { cache: "no-store" });
  if (!res.ok) throw new Error(`无法加载 ${rel} (${res.status})`);
  return res.json() as Promise<T>;
}

export async function fetchIndex(): Promise<ContentIndex> {
  return fetchJson<ContentIndex>("content/index.json");
}

export async function fetchCategories(): Promise<CategoriesFile> {
  return fetchJson<CategoriesFile>("content/categories.json");
}

export async function fetchPromptRulesIndex(): Promise<PromptRulesIndex> {
  return fetchJson<PromptRulesIndex>("prompt-rules/index.json");
}

export async function fetchTopics(): Promise<TopicsFile> {
  return fetchJson<TopicsFile>("topics/index.json");
}

export async function fetchText(relFromContent: string): Promise<string> {
  const res = await fetch(assetUrl(`content/${relFromContent}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`无法加载 ${relFromContent} (${res.status})`);
  return res.text();
}

export async function fetchPromptFile(fileName: string): Promise<string> {
  const res = await fetch(assetUrl(`prompt-rules/${fileName}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`无法加载 prompt-rules/${fileName} (${res.status})`);
  return res.text();
}

export async function fetchTopicRulesIndex(): Promise<PromptSection> {
  const idx = await fetchPromptRulesIndex();
  return idx.topic;
}

export async function fetchPostRulesIndex(): Promise<PromptSection> {
  const idx = await fetchPromptRulesIndex();
  return idx.post;
}

/** @deprecated 用 fetchPostRulesIndex */
export async function fetchBodyRulesIndex(): Promise<PromptSection> {
  return fetchPostRulesIndex();
}
