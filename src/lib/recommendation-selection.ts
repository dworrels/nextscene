import type { MediaItem } from "@/types/tmdb";
import type { ConfidenceLevel } from "@/lib/personal-model";

export type RecommendationSource = "personal" | "discovery" | "taste-discover";
export type RankedMediaItem = { item: MediaItem; personalSimilarity: number; matchScore: number; confidence: ConfidenceLevel; source: RecommendationSource };
export const PROFILE_CATEGORIES = [
  { key: "high-match-scores", title: "Top picks for you" },
  { key: "best-bets", title: "Tonight's best bets" },
  { key: "your-wheelhouse", title: "More in your wheelhouse" },
  { key: "something-different", title: "Try something a little different" },
  { key: "fresh", title: "Fresh and coming soon" },
  { key: "watchlist", title: "Your watchlist, narrowed down" },
] as const;
export type ProfileCategoryKey = typeof PROFILE_CATEGORIES[number]["key"];
export type ProfileRail = { key: ProfileCategoryKey; title: string; items: MediaItem[]; predictedBadges?: Record<string, string> };
// Also used by recommendations.ts to re-filter/re-sort this rail once its
// items are re-scored against their full profile — see refinePredictedBadges.
export const HIGH_MATCH_THRESHOLD = 75;

function keyFor(item: Pick<MediaItem, "id" | "mediaType">): string {
  return `${item.mediaType}-${item.id}`;
}

function takeUnseen(entries: RankedMediaItem[], seen: Set<string>, limit: number): MediaItem[] {
  const picked: MediaItem[] = [];
  for (const { item } of entries) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
    if (picked.length === limit) break;
  }
  return picked;
}

function takeDiverse(entries: RankedMediaItem[], seen: Set<string>, limit: number): MediaItem[] {
  const picked: MediaItem[] = [];
  const genreCounts = new Map<string, number>();
  for (const { item } of entries) {
    const key = keyFor(item);
    const genre = item.genre.toLowerCase();
    if (seen.has(key) || (genreCounts.get(genre) ?? 0) >= 2) continue;
    seen.add(key);
    genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    picked.push(item);
    if (picked.length === limit) break;
  }
  return picked;
}

// Same number and framing as WhyWatch's "Predicted rating for you" — a
// separate "N% match" badge (matchScore is just estimatedRating * 10) reads
// as a second, possibly-disagreeing metric when it's actually the same one.
// FilmCard adds a compact "For you" label, distinguishing this prediction
// from an actual or audience rating without using an additional icon.
function predictedBadgesFor(items: MediaItem[], ranked: RankedMediaItem[]): Record<string, string> {
  const scoresByKey = new Map(ranked.map((entry) => [keyFor(entry.item), entry]));
  return Object.fromEntries(items.flatMap((item) => {
    const entry = scoresByKey.get(keyFor(item));
    return entry && entry.confidence !== "low" ? [[keyFor(item), (entry.matchScore / 10).toFixed(1)]] : [];
  }));
}

function compatibleDiscovery(ranked: RankedMediaItem[]): RankedMediaItem[] {
  const discovery = ranked.filter((entry) => entry.source === "discovery" && entry.personalSimilarity >= 0);
  return discovery.slice(Math.floor(discovery.length / 3));
}

export function buildProfileCategory(
  key: ProfileCategoryKey,
  ranked: RankedMediaItem[],
  fresh: RankedMediaItem[],
  watchlist: RankedMediaItem[],
  limit: number,
): ProfileRail {
  const seen = new Set<string>();
  const title = PROFILE_CATEGORIES.find((category) => category.key === key)?.title ?? key;
  if (key === "high-match-scores") {
    const items = takeUnseen(ranked.filter((entry) => entry.matchScore >= HIGH_MATCH_THRESHOLD), seen, limit);
    return { key, title, items, predictedBadges: predictedBadgesFor(items, ranked) };
  }
  if (key === "best-bets") return { key, title, items: takeUnseen(ranked, seen, limit) };
  if (key === "your-wheelhouse") return { key, title, items: takeUnseen(ranked.filter((entry) => entry.source === "personal" || entry.source === "taste-discover"), seen, limit) };
  if (key === "something-different") return { key, title, items: takeUnseen(compatibleDiscovery(ranked), seen, limit) };
  if (key === "fresh") return { key, title, items: takeUnseen(fresh, seen, limit) };
  return { key, title, items: takeUnseen(watchlist, seen, limit) };
}

export function buildProfileRails(ranked: RankedMediaItem[], fresh: RankedMediaItem[], watchlist: RankedMediaItem[], limit: number): ProfileRail[] {
  const seen = new Set<string>();
  const rails: ProfileRail[] = [];
  const add = (key: ProfileCategoryKey, items: MediaItem[], predictedBadges?: Record<string, string>) => {
    const title = PROFILE_CATEGORIES.find((category) => category.key === key)?.title ?? key;
    if (items.length > 0) rails.push({ key, title, items, predictedBadges });
  };

  const highMatches = takeDiverse(ranked.filter((entry) => entry.matchScore >= HIGH_MATCH_THRESHOLD), seen, limit);
  add("high-match-scores", highMatches, predictedBadgesFor(highMatches, ranked));

  add("best-bets", takeDiverse(ranked, seen, limit));
  add("your-wheelhouse", takeUnseen(ranked.filter((entry) => entry.source === "personal" || entry.source === "taste-discover"), seen, limit));

  // Skip the closest discovery third so this shelf is a compatible stretch,
  // not simply a generic-source copy of the strongest-fit shelf.
  add("something-different", takeUnseen(compatibleDiscovery(ranked), seen, limit));
  add("fresh", takeUnseen(fresh, seen, limit));
  add("watchlist", takeUnseen(watchlist, seen, limit));
  return rails;
}
