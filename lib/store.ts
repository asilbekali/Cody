/**
 * Storage adapter.
 *
 * Production (Vercel): Vercel Blob.
 *   - `data/**`  -> access: 'private'  (never publicly fetchable: holds password hashes)
 *   - `media/**` -> access: 'public'   (images + video served straight from the CDN)
 *
 * Local dev without a BLOB_READ_WRITE_TOKEN: falls back to `.data-dev/` on disk so
 * you can run `next dev` with zero setup.
 */
import { put, del, list, get } from "@vercel/blob";
import path from "node:path";
import fs from "node:fs/promises";

const DEV_ROOT = path.join(process.cwd(), ".data-dev");

/**
 * Real Vercel Blob tokens are `vercel_blob_rw_<store>_<secret>`. We match on that
 * prefix rather than "is the variable set", so a leftover placeholder (or an empty
 * value from Vercel's UI) is treated as "no store" instead of failing every read
 * and write with "Access denied".
 */
export function hasBlobStore() {
  return (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim().startsWith("vercel_blob_rw_");
}

/**
 * The `.data-dev/` fallback only works where the filesystem is writable. On Vercel
 * the bundle lives in a read-only `/var/task`, so writing there fails with a bare
 * ENOENT that says nothing about the real problem. Detect that case explicitly and
 * report the actual cause instead.
 */
function canUseDevFallback() {
  return !process.env.VERCEL;
}

export const NO_BLOB_STORE_MESSAGE =
  "No Blob store is connected to this deployment. In Vercel open Storage -> Create Database -> Blob, " +
  "connect it to this project, then redeploy. BLOB_READ_WRITE_TOKEN is injected automatically.";

/** True when the app has nowhere to persist data: deployed, with no Blob store. */
export function storageUnavailable() {
  return !hasBlobStore() && !canUseDevFallback();
}

/** JSON data blobs are cached briefly at the edge; reads always bypass that cache. */
const DATA_CACHE_SECONDS = 60;

type Record_<T> = { value: T; etag: string | null };

/* -------------------------------------------------------------------------- */
/* local dev filesystem backend                                               */
/* -------------------------------------------------------------------------- */

function devPath(key: string) {
  const safe = key.split("/").filter((s) => s && s !== "." && s !== "..");
  return path.join(DEV_ROOT, ...safe);
}

async function devRead<T>(key: string): Promise<Record_<T> | null> {
  try {
    const raw = await fs.readFile(devPath(key), "utf8");
    return { value: JSON.parse(raw) as T, etag: null };
  } catch {
    return null;
  }
}

async function devWrite(key: string, value: unknown) {
  const file = devPath(key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

async function devList(prefix: string): Promise<string[]> {
  const root = devPath(prefix.endsWith("/") ? prefix : prefix + "/");
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(path.relative(DEV_ROOT, full).split(path.sep).join("/"));
    }
  }
  await walk(root);
  return out;
}

/* -------------------------------------------------------------------------- */
/* public API                                                                 */
/* -------------------------------------------------------------------------- */

async function readRecord<T>(key: string): Promise<Record_<T> | null> {
  // Deployed with no store: there is nothing to read, so render empty rather than 500.
  if (!hasBlobStore()) return canUseDevFallback() ? devRead<T>(key) : null;

  // useCache:false -> read from origin so a just-published post is never stale.
  const res = await get(key, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  try {
    return { value: JSON.parse(text) as T, etag: res.blob.etag };
  } catch {
    return null;
  }
}

export async function readJSON<T>(key: string): Promise<T | null> {
  const rec = await readRecord<T>(key);
  return rec ? rec.value : null;
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  if (!hasBlobStore()) {
    if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
    return devWrite(key, value);
  }
  await put(key, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: DATA_CACHE_SECONDS,
  });
}

export async function removeKey(key: string): Promise<void> {
  if (!hasBlobStore()) {
    if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
    await fs.rm(devPath(key), { force: true });
    return;
  }
  await del(key);
}

export async function listKeys(prefix: string): Promise<string[]> {
  if (!hasBlobStore()) return canUseDevFallback() ? devList(prefix) : [];

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) keys.push(b.pathname);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return keys;
}

/** Reads every JSON object under a prefix, in parallel. Missing/corrupt entries are skipped. */
export async function readAllJSON<T>(prefix: string): Promise<T[]> {
  const keys = await listKeys(prefix);
  // Cast: Promise.all unwraps the generic to Awaited<T>, which TS cannot equate to T here.
  const values = (await Promise.all(keys.map((k) => readJSON<T>(k)))) as (T | null)[];
  return values.filter((v): v is T => v !== null);
}

function isPreconditionFailure(err: unknown) {
  const name = (err as { name?: string })?.name ?? "";
  const message = (err as { message?: string })?.message ?? "";
  return (
    name.includes("Precondition") ||
    /precondition|etag|already exists|conflict/i.test(message)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read-modify-write with optimistic concurrency.
 *
 * Vercel Blob has no transactions, so a shared document (e.g. a post's comment
 * list) could otherwise lose a write when two people act at the same moment.
 * We guard the write with the ETag we read and retry on conflict.
 */
export async function updateJSON<T>(
  key: string,
  mutate: (current: T | null) => T,
  attempts = 5
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    const current = await readRecord<T>(key);
    const next = mutate(current ? current.value : null);

    if (!hasBlobStore()) {
      if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
      await devWrite(key, next);
      return next;
    }

    try {
      await put(key, JSON.stringify(next), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: DATA_CACHE_SECONDS,
        // Existing doc: only overwrite if nobody changed it since we read.
        // New doc: refuse to overwrite, so a concurrent create is caught too.
        ...(current?.etag
          ? { ifMatch: current.etag }
          : { allowOverwrite: false }),
      });
      return next;
    } catch (err) {
      lastError = err;
      if (!isPreconditionFailure(err)) throw err;
      await sleep(40 * (i + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not update ${key} after ${attempts} attempts`);
}
