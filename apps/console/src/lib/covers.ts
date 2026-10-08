import { assetUrl } from "./content";
import { cachedFetchText } from "./local-cache";

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

export const COVER_INDEX_CACHE_KEY = "cover/cover.json";

export async function fetchCovers(): Promise<CoverIndex> {
  const text = await cachedFetchText(
    COVER_INDEX_CACHE_KEY,
    assetUrl("cover/cover.json"),
    {
      metaFromBody: (body) => {
        try {
          return String((JSON.parse(body) as CoverIndex).updatedAt || "");
        } catch {
          return "";
        }
      },
    },
  );
  const data = JSON.parse(text) as CoverIndex;
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
