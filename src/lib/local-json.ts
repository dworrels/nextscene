import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

type Validator<T> = (value: unknown) => value is T;

export async function readJsonFile<T>(filePath: string, fallback: T, isValid: Validator<T>, label: string): Promise<T> {
  try {
    const value: unknown = JSON.parse(await readFile(filePath, "utf-8"));
    if (isValid(value)) return value;
    console.warn(`${label} has an invalid format; ignoring it rather than using partial data.`);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn(`Couldn't read ${label}; ignoring it rather than using partial data.`);
  }
  return fallback;
}

// Renaming a completed temporary file prevents an interrupted write from
// leaving a truncated JSON file behind.
export async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2), "utf-8");
  await rename(temporaryPath, filePath);
}

// Serializes read-modify-write operations within this Node process. Atomic
// writes still protect the file if the process stops halfway through a write.
export function createAsyncQueue() {
  let tail = Promise.resolve();

  return async function queue<T>(operation: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    tail = previous.catch(() => undefined).then(() => gate);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release?.();
    }
  };
}
