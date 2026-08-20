import type { MediaItem } from "@/types/tmdb";
import type { ConfidenceLevel } from "@/lib/personal-model";

export type SemanticSearchResult = { item: MediaItem; similarity: number; predictedRating: number | null; predictedConfidence: ConfidenceLevel | null };
export type VibeGenreFilter = { movieGenreId: number; tvGenreId: number; terms: RegExp };

// TMDb's movie and TV genre IDs are stable. These are used only to broaden the
// candidate pool; embeddings remain responsible for final relevance ranking.
const VIBE_GENRE_FILTERS: VibeGenreFilter[] = [
  { movieGenreId: 9648, tvGenreId: 9648, terms: /\bmystery|twist|unreliable|detective|whodunit|investigat/i },
  { movieGenreId: 53, tvGenreId: 9648, terms: /\bthriller|suspense|tense|paranoia|conspiracy/i },
  { movieGenreId: 80, tvGenreId: 80, terms: /\bcrime|heist|gangster|noir|police/i },
  { movieGenreId: 878, tvGenreId: 10765, terms: /\bsci[- ]?fi|science fiction|space|alien|future|dystop|time travel/i },
  { movieGenreId: 27, tvGenreId: 9648, terms: /\bhorror|scary|dark|haunted|supernatural|creepy/i },
  { movieGenreId: 35, tvGenreId: 35, terms: /\bcomedy|funny|humou?r|laugh|witty|smart/i },
  { movieGenreId: 18, tvGenreId: 18, terms: /\bdrama|character[- ]driven|emotional|human|relationship/i },
  { movieGenreId: 10749, tvGenreId: 18, terms: /\bromance|romantic|love story/i },
  { movieGenreId: 16, tvGenreId: 16, terms: /\banimation|animated|anime/i },
  { movieGenreId: 99, tvGenreId: 99, terms: /\bdocumentary|documentary series|true story/i },
];

export function extractVibeGenres(query: string, limit = 3): VibeGenreFilter[] {
  return VIBE_GENRE_FILTERS.filter((filter) => filter.terms.test(query)).slice(0, limit);
}

// Relative to the top match rather than a fixed number, since absolute
// cosine similarity varies by phrasing and embedding model. A query with no
// genuinely strong matches shouldn't pad itself out with tenuous ones just
// to hit a result count.
const RELATIVE_SIMILARITY_FLOOR = 0.82;

export function filterConfidentResults(results: SemanticSearchResult[]): SemanticSearchResult[] {
  const top = results[0]?.similarity ?? 0;
  if (top <= 0) return results;
  const floor = top * RELATIVE_SIMILARITY_FLOOR;
  return results.filter((result) => result.similarity >= floor);
}

// Keep the first screen varied without hiding the best semantic matches. Only
// the top `diverseLead * 2` raw-ranked results are eligible for the diverse
// lead — genre variety is worth seeking out nearby, but not worth reaching
// arbitrarily deep into weaker matches for. If the window doesn't have
// enough distinct genres to fill diverseLead slots, the shortfall is left to
// the plain rank-order fill below rather than forced from further down.
export function diversifyVibeResults(results: SemanticSearchResult[], limit: number, diverseLead = 12, maxPerGenre = 2): SemanticSearchResult[] {
  const window = results.slice(0, diverseLead * 2);
  const selected: SemanticSearchResult[] = [];
  const selectedKeys = new Set<string>();
  const genreCounts = new Map<string, number>();

  for (const result of window) {
    if (selected.length === Math.min(diverseLead, limit)) break;
    const genre = result.item.genre.toLowerCase();
    if ((genreCounts.get(genre) ?? 0) >= maxPerGenre) continue;
    selected.push(result);
    selectedKeys.add(`${result.item.mediaType}-${result.item.id}`);
    genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
  }

  for (const result of results) {
    if (selected.length === limit) break;
    const key = `${result.item.mediaType}-${result.item.id}`;
    if (selectedKeys.has(key)) continue;
    selected.push(result);
    selectedKeys.add(key);
  }
  return selected;
}
