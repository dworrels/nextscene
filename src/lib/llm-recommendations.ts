import { createHash } from "crypto";
import path from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createAsyncQueue, readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import { readContentPreferences, type ContentPreferences } from "@/lib/content-preferences";
import { getPersonallyRankedCandidates, getTasteSummary } from "@/lib/recommendations";
import type { WhyWatchInsight } from "@/lib/recommendations";
import { readRatings } from "@/lib/ratings";
import { readWatchlist } from "@/lib/watchlist";
import type { MediaItem } from "@/types/tmdb";

const CHAT_MODEL = "gpt-5.5";
const DETAIL_EXPLANATION_MODEL = "gpt-5.6-luna";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const AI_PICKS_CACHE_PATH = path.join(process.cwd(), "data", "ai-picks.json");
const DETAIL_EXPLANATION_CACHE_PATH = path.join(process.cwd(), "data", "why-watch.json");
const PERSONAL_SCORING_VERSION = 2;

const RerankResult = z.object({
  picks: z.array(z.object({
    id: z.number(),
    mediaType: z.enum(["movie", "tv"]),
    reason: z.string().min(1).max(280),
  })).max(12),
});
const DetailExplanationResult = z.object({ explanation: z.string().min(1).max(520) });

export type RankedPick = { item: MediaItem; score: number; reason: string };
type AiPicksCache = { tasteHash: string; expiresAt: string; picks: RankedPick[] };
type DetailExplanationRecord = { explanation: string; updatedAt: string };
type DetailExplanationCache = { entries: Record<string, DetailExplanationRecord | string> };
const MAX_DETAIL_EXPLANATIONS = 500;
const queueDetailExplanationWrite = createAsyncQueue();

function isAiPicksCache(value: unknown): value is AiPicksCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cache = value as AiPicksCache;
  return typeof cache.tasteHash === "string" && typeof cache.expiresAt === "string" && Array.isArray(cache.picks);
}

function isDetailExplanationCache(value: unknown): value is DetailExplanationCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = (value as { entries?: unknown }).entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return false;
  return Object.values(entries).every((entry) => (
    typeof entry === "string"
    || (!!entry && typeof entry === "object" && typeof (entry as DetailExplanationRecord).explanation === "string" && typeof (entry as DetailExplanationRecord).updatedAt === "string")
  ));
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey });
}

function hashRecommendationContext(tasteSummary: string, ratings: unknown, watchlist: unknown, preferences: ContentPreferences): string {
  return createHash("sha256").update(JSON.stringify({ model: CHAT_MODEL, scoringVersion: PERSONAL_SCORING_VERSION, tasteSummary, ratings, watchlist, preferences })).digest("hex");
}

async function readCachedPicks(tasteHash: string): Promise<RankedPick[] | null> {
  const cache = await readJsonFile(AI_PICKS_CACHE_PATH, null, (value): value is AiPicksCache | null => value === null || isAiPicksCache(value), "AI picks cache");
  if (!cache || cache.tasteHash !== tasteHash || new Date(cache.expiresAt).getTime() <= Date.now()) return null;
  return cache.picks;
}

async function writeCachedPicks(tasteHash: string, picks: RankedPick[]): Promise<void> {
  const cache: AiPicksCache = {
    tasteHash,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    picks,
  };
  await writeJsonFileAtomic(AI_PICKS_CACHE_PATH, cache);
}

function detailExplanationKey(item: MediaItem, insight: WhyWatchInsight): string {
  return createHash("sha256")
    .update(JSON.stringify({ model: DETAIL_EXPLANATION_MODEL, scoringVersion: PERSONAL_SCORING_VERSION, item, insight }))
    .digest("hex");
}

async function readCachedDetailExplanation(key: string): Promise<string | null> {
  const cache = await readJsonFile(DETAIL_EXPLANATION_CACHE_PATH, { entries: {} }, isDetailExplanationCache, "why-watch cache");
  const entry = cache.entries[key];
  return typeof entry === "string" ? entry : entry?.explanation ?? null;
}

async function writeCachedDetailExplanation(key: string, explanation: string): Promise<void> {
  await queueDetailExplanationWrite(async () => {
    const cache = await readJsonFile(DETAIL_EXPLANATION_CACHE_PATH, { entries: {} }, isDetailExplanationCache, "why-watch cache");
    const normalized = Object.fromEntries(Object.entries(cache.entries).map(([cacheKey, entry]) => [cacheKey, typeof entry === "string" ? { explanation: entry, updatedAt: "" } : entry]));
    normalized[key] = { explanation, updatedAt: new Date().toISOString() };
    const boundedEntries = Object.fromEntries(
      Object.entries(normalized)
        .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_DETAIL_EXPLANATIONS),
    );
    await writeJsonFileAtomic(DETAIL_EXPLANATION_CACHE_PATH, { entries: boundedEntries });
  });
}

export async function getDetailedWhyWatchExplanation(item: MediaItem, insight: WhyWatchInsight): Promise<string> {
  const key = detailExplanationKey(item, insight);
  const cached = await readCachedDetailExplanation(key);
  if (cached) return cached;

  const completion = await getClient().chat.completions.parse({
    model: DETAIL_EXPLANATION_MODEL,
    reasoning_effort: "none",
    messages: [
      {
        role: "system",
        content: "Turn verified recommendation evidence into a concise, balanced explanation. The numerical estimate and confidence were calculated by a personal model: do not revise them or introduce new evidence. Use only the supplied title metadata, learned rating patterns, similar rated titles, and mismatch signals. Do not invent plot details, cast, creators, awards, or viewing history. Do not present the estimate as certainty.",
      },
      {
        role: "user",
        content: `Title metadata:\n${item.title} (${item.mediaType}, ${item.year})\nGenres: ${(item.genres?.length ? item.genres : [item.genre]).join(", ")}\nOriginal language: ${item.originalLanguageCode ?? "unknown"}\nRuntime: ${item.runtimeMinutes ?? "unknown"}\nKeywords: ${item.keywords?.join(", ") || "none supplied"}\nOverview: ${item.overview}\n\nPersonal model estimate: ${insight.estimatedRating}/10\nConfidence: ${insight.confidence} (expected error ±${insight.estimatedError})\nTraining evidence: ${insight.ratingCount} ratings; ${insight.validationCount} held-out validation ratings\nLiked references: ${insight.liked.map((reference) => `${reference.title} (${reference.rating}/10)`).join(", ") || "none"}\nCaution references: ${insight.cautions.map((reference) => `${reference.title} (${reference.rating}/10)`).join(", ") || "none"}\nVerified positive signals: ${insight.reasons.map((reason) => `${reason.heading}: ${reason.detail}`).join(" ")}\nVerified mismatch signals: ${insight.mismatchReasons.map((reason) => `${reason.heading}: ${reason.detail}`).join(" ") || "none"}`,
      },
    ],
    response_format: zodResponseFormat(DetailExplanationResult, "why_watch"),
  });
  const explanation = completion.choices[0]?.message.parsed?.explanation;
  if (!explanation) throw new Error("The explanation response was empty.");
  await writeCachedDetailExplanation(key, explanation);
  return explanation;
}

// Retrieval already happened (candidates come from TMDb recommendations/discover
// or embedding similarity) — this only reranks and explains a short list, it
// never invents titles, and the response is validated against `candidates` so a
// hallucinated id/mediaType pair can't slip through even if the model gets one wrong.
export async function rerankWithReasons(
  candidates: Array<{ item: MediaItem; score: number }>,
  tasteSummary: string,
  preferences: ContentPreferences,
  limit = 8,
): Promise<RankedPick[]> {
  if (candidates.length === 0) return [];

  const client = getClient();
  const candidateList = candidates
    .map(({ item, score }) => `- id=${item.id} mediaType=${item.mediaType} personalScore=${score} "${item.title}" (${item.year}, ${item.genre}, original language: ${item.originalLanguageCode ?? "unknown"}): ${item.overview.slice(0, 200)}`)
    .join("\n");

  const completion = await client.chat.completions.parse({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `You select and explain movies and TV shows from a fixed candidate list. Each personalScore was calculated by the app's personal model; never change or replace it. Only pick supplied candidates and give one concrete sentence grounded in the supplied taste profile and metadata.${preferences.preferEnglishOriginalLanguage ? " The user gently prefers English-original titles: use original language only as a tie-breaker, while retaining clearly stronger non-English matches." : ""}`,
      },
      {
        role: "user",
        content: `User's taste profile:\n${tasteSummary}\n\nCandidates:\n${candidateList}\n\nPick the best ${limit} for this user.`,
      },
    ],
    response_format: zodResponseFormat(RerankResult, "picks"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) return [];

  const byKey = new Map(candidates.map((candidate) => [`${candidate.item.mediaType}-${candidate.item.id}`, candidate]));
  const picks: RankedPick[] = [];
  const seen = new Set<string>();
  for (const pick of parsed.picks) {
    const key = `${pick.mediaType}-${pick.id}`;
    const candidate = byKey.get(key);
    if (candidate && !seen.has(key)) {
      seen.add(key);
      picks.push({ item: candidate.item, score: candidate.score, reason: pick.reason });
    }
  }
  return picks.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getAiPicks(): Promise<RankedPick[] | null> {
  const [tasteSummary, ratings, watchlist, preferences] = await Promise.all([getTasteSummary(), readRatings(), readWatchlist(), readContentPreferences()]);
  if (!tasteSummary) return null;
  const tasteHash = hashRecommendationContext(tasteSummary, ratings.rows, watchlist.rows, preferences);
  const cached = await readCachedPicks(tasteHash);
  if (cached) return cached;

  const ranked = await getPersonallyRankedCandidates();
  if (ranked.length === 0) return null;

  const picks = await rerankWithReasons(ranked.map(({ item, personalSimilarity }) => ({
    item,
    score: Math.round(Math.max(1, Math.min(99, personalSimilarity * 100))),
  })), tasteSummary, preferences).catch(() => null);
  if (picks && picks.length > 0) await writeCachedPicks(tasteHash, picks);
  return picks;
}
