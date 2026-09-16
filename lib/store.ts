/**
 * Storage adapter.
 *
 * Production (Vercel): Vercel Blob.
 *   - `data/**`  -> access: 'private'  (never publicly fetchable: holds password hashes)
 *   - `media/**` -> access: 'public'   (images + video served straight from the CDN)
 *
 * Local dev with no Blob credentials: falls back to `.data-dev/` on disk so you can
 * run `next dev` with zero setup. Never on Vercel, where the filesystem is read-only.
 */
import { put, del, list, get } from "@vercel/blob";
import path from "node:path";
import fs from "node:fs/promises";

const DEV_ROOT = path.join(process.cwd(), ".data-dev");

/* -------------------------------------------------------------------------- */
/* credentials                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Vercel hands a connected Blob store to the app in one of two shapes, and which
 * one you get depends on how the store was connected:
 *
 *   - a read-write token, `vercel_blob_rw_<store>_<secret>`. Usually named
 *     BLOB_READ_WRITE_TOKEN, but a store connected with an environment-variable
 *     prefix gets that prefix instead (`blog_READ_WRITE_TOKEN`, ...).
 *   - OIDC: `VERCEL_OIDC_TOKEN`, injected automatically, plus a store id
 *     (`BLOB_STORE_ID`, or a prefixed `<prefix>_STORE_ID`) naming the store.
 *
 * Rather than hard-code one variable name and break when the store is reconnected
 * differently, find the credentials by their *value*: a read-write token and a
 * store id are both self-identifying. Every SDK call is then passed what we found,
 * instead of relying on the SDK's own BLOB_READ_WRITE_TOKEN-only lookup.
 */
export type BlobCredentials = { token: string } | { storeId: string };

const RW_TOKEN_PREFIX = "vercel_blob_rw_";
const STORE_ID_PATTERN = /^store_[A-Za-z0-9]+$/;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** First environment value matching `test`, whatever the variable is called. */
function findEnvValue(test: (value: string) => boolean) {
  for (const raw of Object.values(process.env)) {
    const value = raw?.trim();
    if (value && test(value)) return value;
  }
  return undefined;
}

function resolveCredentials(): BlobCredentials | null {
  const token = findEnvValue((v) => v.startsWith(RW_TOKEN_PREFIX));
  if (token) return { token };

  if (envValue("VERCEL_OIDC_TOKEN")) {
    const storeId =
      envValue("BLOB_STORE_ID") ?? findEnvValue((v) => STORE_ID_PATTERN.test(v));
    if (storeId) return { storeId };
  }

  return null;
}

// Environment variables do not change while the process lives, so resolve once.
let cachedCredentials: BlobCredentials | null | undefined;

export function blobCredentials(): BlobCredentials | null {
  if (cachedCredentials === undefined) cachedCredentials = resolveCredentials();
  return cachedCredentials;
}

/** True when the app can read and write a Blob store. */
export function storageConfigured() {
  return blobCredentials() !== null;
}

/**
 * Whether the browser can upload straight to Blob. That needs a read-write token
 * to mint a short-lived client token from; OIDC credentials cannot, so those
 * uploads go through the server instead (see app/api/media/route.ts).
 */
export function hasBlobStore() {
  const credentials = blobCredentials();
  return credentials !== null && "token" in credentials;
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
  "connect it to this project, then redeploy so the store's environment variables are picked up.";

/** True when the app has nowhere to persist data: deployed, with no Blob store. */
export function storageUnavailable() {
  return !storageConfigured() && !canUseDevFallback();
}

/** Spread into every SDK call so it uses the credentials we actually found. */
function auth() {
  const credentials = blobCredentials();
  if (!credentials) throw new Error(NO_BLOB_STORE_MESSAGE);
  return credentials;
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
  if (!storageConfigured()) return canUseDevFallback() ? devRead<T>(key) : null;

  // useCache:false -> read from origin so a just-published post is never stale.
  const res = await get(key, { access: "private", useCache: false, ...auth() });
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
  if (!storageConfigured()) {
    if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
    return devWrite(key, value);
  }
  await put(key, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: DATA_CACHE_SECONDS,
    ...auth(),
  });
}

export async function removeKey(key: string): Promise<void> {
  if (!storageConfigured()) {
    if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
    await fs.rm(devPath(key), { force: true });
    return;
  }
  await del(key, auth());
}

export async function listKeys(prefix: string): Promise<string[]> {
  if (!storageConfigured()) return canUseDevFallback() ? devList(prefix) : [];

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix, cursor, limit: 1000, ...auth() });
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

    if (!storageConfigured()) {
      if (!canUseDevFallback()) throw new Error(NO_BLOB_STORE_MESSAGE);
      await devWrite(key, next);
      return next;
    }

    try {
      await put(key, JSON.stringify(next), {
        access: "private",
        ...auth(),
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
