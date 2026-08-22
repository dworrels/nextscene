import { createHash } from "crypto";
import path from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { createAsyncQueue, readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import type { WhyWatchInsight } from "@/lib/recommendations";
import type { MediaItem } from "@/types/tmdb";

const DETAIL_EXPLANATION_MODEL = "gpt-5.6-luna";
const DETAIL_EXPLANATION_CACHE_PATH = path.join(process.cwd(), "data", "why-watch.json");
const PERSONAL_SCORING_VERSION = 2;
// Bump whenever the prompt text below changes — the cache key doesn't hash
// the prompt itself, so without this a wording fix would keep serving
// explanations generated under the old instructions until they age out.
const EXPLANATION_PROMPT_VERSION = 2;

const DetailExplanationResult = z.object({ explanation: z.string().min(1).max(520) });

type DetailExplanationRecord = { explanation: string; updatedAt: string };
type DetailExplanationCache = { entries: Record<string, DetailExplanationRecord | string> };
const MAX_DETAIL_EXPLANATIONS = 500;
const queueDetailExplanationWrite = createAsyncQueue();

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

function detailExplanationKey(item: MediaItem, insight: WhyWatchInsight): string {
  return createHash("sha256")
    .update(JSON.stringify({ model: DETAIL_EXPLANATION_MODEL, scoringVersion: PERSONAL_SCORING_VERSION, promptVersion: EXPLANATION_PROMPT_VERSION, item, insight }))
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
        content: "Turn verified recommendation evidence into a concise, balanced explanation, written the way a friend who knows your taste would talk — never as a data report. The estimate and confidence level were calculated separately: use them to judge how strongly to hedge, but don't restate them as figures, and don't revise them or introduce new evidence. Use only the supplied title metadata, rating patterns, similar rated titles, and mismatch signals. Do not invent plot details, cast, creators, awards, or viewing history. Never use technical or statistical language — no \"model,\" \"confidence score,\" \"expected error,\" \"training data,\" or similar terms. If the estimate is less certain, say so in plain words instead of citing a margin, and never present the estimate as certainty.",
      },
      {
        role: "user",
        content: `Title metadata:\n${item.title} (${item.mediaType}, ${item.year})\nGenres: ${(item.genres?.length ? item.genres : [item.genre]).join(", ")}\nOriginal language: ${item.originalLanguageCode ?? "unknown"}\nRuntime: ${item.runtimeMinutes ?? "unknown"}\nKeywords: ${item.keywords?.join(", ") || "none supplied"}\nOverview: ${item.overview}\n\nPredicted rating for this user: ${insight.estimatedRating}/10\nConfidence in this estimate: ${insight.confidence}\nBased on ${insight.ratingCount} of the user's ratings\nLiked references: ${insight.liked.map((reference) => `${reference.title} (${reference.rating}/10)`).join(", ") || "none"}\nCaution references: ${insight.cautions.map((reference) => `${reference.title} (${reference.rating}/10)`).join(", ") || "none"}\nVerified positive signals: ${insight.reasons.map((reason) => `${reason.heading}: ${reason.detail}`).join(" ")}\nVerified mismatch signals: ${insight.mismatchReasons.map((reason) => `${reason.heading}: ${reason.detail}`).join(" ") || "none"}`,
      },
    ],
    response_format: zodResponseFormat(DetailExplanationResult, "why_watch"),
  });
  const explanation = completion.choices[0]?.message.parsed?.explanation;
  if (!explanation) throw new Error("The explanation response was empty.");
  await writeCachedDetailExplanation(key, explanation);
  return explanation;
}
