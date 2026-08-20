import { createHash } from "crypto";
import path from "path";
import OpenAI from "openai";
import { createAsyncQueue, readJsonFile, writeJsonFileAtomic } from "@/lib/local-json";
import type { MediaItem } from "@/types/tmdb";

const EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbeddingRecord = { vector: number[]; textHash: string; model: string; updatedAt: string };
type EmbeddingsFile = Record<string, EmbeddingRecord>;

const DATA_DIR = path.join(process.cwd(), "data");
const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json");
const MAX_EMBEDDING_RECORDS = 7_500;
const queueEmbeddingWrite = createAsyncQueue();

function isEmbeddingsFile(value: unknown): value is EmbeddingsFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((record) => (
    !!record
    && typeof record === "object"
    && Array.isArray((record as EmbeddingRecord).vector)
    && (record as EmbeddingRecord).vector.every((value) => typeof value === "number")
    && typeof (record as EmbeddingRecord).textHash === "string"
    && typeof (record as EmbeddingRecord).model === "string"
    && typeof (record as EmbeddingRecord).updatedAt === "string"
  ));
}

async function readEmbeddings(): Promise<EmbeddingsFile> {
  return readJsonFile(EMBEDDINGS_PATH, {}, isEmbeddingsFile, "embeddings cache");
}

async function mergeEmbeddingUpdates(updates: EmbeddingsFile): Promise<EmbeddingsFile> {
  return queueEmbeddingWrite(async () => {
    const current = await readEmbeddings();
    const merged = { ...current, ...updates };
    const bounded = Object.fromEntries(
      Object.entries(merged)
        .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_EMBEDDING_RECORDS),
    );
    await writeJsonFileAtomic(EMBEDDINGS_PATH, bounded);
    return bounded;
  });
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey });
}

function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Cache only the exact representation embedded. TMDb metadata and this text
// format can change, so a title is re-embedded whenever either does.
async function embedMany(entries: Array<{ key: string; text: string }>): Promise<Map<string, number[]>> {
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.key, entry])).values()];
  const cache = await readEmbeddings();
  const missing = uniqueEntries.filter((entry) => {
    const record = cache[entry.key];
    return !record || record.model !== EMBEDDING_MODEL || record.textHash !== textHash(entry.text);
  });

  if (missing.length > 0) {
    const client = getClient();
    const BATCH_SIZE = 100;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((entry) => entry.text),
      });
      response.data.forEach((item, index) => {
        cache[batch[index].key] = {
          vector: item.embedding,
          textHash: textHash(batch[index].text),
          model: EMBEDDING_MODEL,
          updatedAt: new Date().toISOString(),
        };
      });
    }
    const updates = Object.fromEntries(missing.map((entry) => [entry.key, cache[entry.key]]));
    Object.assign(cache, await mergeEmbeddingUpdates(updates));
  }

  const result = new Map<string, number[]>();
  for (const entry of entries) {
    const record = cache[entry.key];
    if (record) result.set(entry.key, record.vector);
  }
  return result;
}

export function buildEmbeddingText(item: MediaItem): string {
  const metadata = [
    `Title: ${item.title}`,
    `Year: ${item.year}`,
    `Format: ${item.mediaType === "tv" ? "TV series" : "movie"}`,
    `Genres: ${(item.genres?.length ? item.genres : [item.genre]).join(", ")}`,
    item.originalLanguageCode ? `Original language: ${item.originalLanguageCode}` : null,
    item.runtimeMinutes ? `Runtime: ${item.runtimeMinutes} minutes` : null,
    item.people?.length ? `Key people: ${item.people.join(", ")}` : null,
    item.keywords?.length ? `Keywords: ${item.keywords.join(", ")}` : null,
    item.networkNames?.length ? `Networks: ${item.networkNames.join(", ")}` : null,
    item.seasonCount ? `Seasons: ${item.seasonCount}` : null,
    item.episodeCount ? `Episodes: ${item.episodeCount}` : null,
    item.overview ? `Overview: ${item.overview}` : null,
  ].filter(Boolean);
  return metadata.join(". ");
}

export async function embedMediaItems(items: MediaItem[]): Promise<Map<string, number[]>> {
  const entries = items.map((item) => ({ key: `${item.mediaType}-${item.id}`, text: buildEmbeddingText(item) }));
  return embedMany(entries);
}

export async function embedQuery(query: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: query });
  return response.data[0].embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Weighted centroid of a user's rated titles: a rating of 10 contributes +1,
// a rating of 1 contributes -1, so titles you disliked pull the profile away
// from similar titles rather than being ignored (a plain average of only
// highly-rated titles can't represent "not like this").
export function weightedTasteVector(rated: Array<{ vector: number[]; rating: number }>): number[] | null {
  if (rated.length === 0) return null;
  const dimensions = rated[0].vector.length;
  const sum = new Array<number>(dimensions).fill(0);

  for (const { vector, rating } of rated) {
    const weight = (rating - 5.5) / 4.5;
    for (let i = 0; i < dimensions; i++) sum[i] += vector[i] * weight;
  }

  const norm = Math.sqrt(sum.reduce((total, value) => total + value * value, 0));
  if (norm === 0) return null;
  return sum.map((value) => value / norm);
}
