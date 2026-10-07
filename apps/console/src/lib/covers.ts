import { assetUrl } from "./content";

export type CoverItem = {
  id: string;
  title: string;
  image: string | null;
  active: boolean;
  prompt: string | null;
  note: string | null;
};

export type CoverIndex = {
  covers: CoverItem[];
  updatedAt: string | null;
};

export async function fetchCovers(): Promise<CoverIndex> {
  const response = await fetch(assetUrl("cover/cover.json"), { cache: "no-store" });
  if (!response.ok) throw new Error(`无法加载封面清单（${response.status}）`);
  const data = (await response.json()) as CoverIndex;
  return {
    covers: Array.isArray(data.covers) ? data.covers : [],
    updatedAt: data.updatedAt ?? null,
  };
}

export function coverImageUrl(image: string | null): string | null {
  if (!image) return null;
  const rel = image.replace(/^\.\//, "").replace(/^\/+/, "");
  return assetUrl(`cover/${rel}`);
}
