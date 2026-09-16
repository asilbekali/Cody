/**
 * Password hashing + session signing built on Web Crypto, so the same code runs
 * in the Node.js and Edge runtimes without a native dependency.
 */

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 150_000;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Compares two strings in constant time to avoid leaking a match via timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

/** Returns `salt:hash`. */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toHex(salt)}:${await derive(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, expected] = stored.split(":");
  if (!saltHex || !expected) return false;
  const actual = await derive(password, fromHex(saltHex));
  return safeEqual(actual, expected);
}

/* -------------------------------------------------------------------------- */
/* signed session tokens                                                      */
/* -------------------------------------------------------------------------- */

function b64urlEncode(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? enc.encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is missing. Set it in your Vercel project environment variables."
    );
  }
  // Dev-only fallback so `next dev` runs before any env setup.
  return "dev-only-insecure-secret-do-not-use-in-production";
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payload: string) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

export type SessionClaims = {
  /** Subject: member id, or "owner". */
  sub: string;
  role: "owner" | "member";
  name?: string;
  /** Expiry, epoch seconds. */
  exp: number;
};

export async function createToken(
  claims: Omit<SessionClaims, "exp">,
  ttlSeconds: number
) {
  const payload = b64urlEncode(
    JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  if (!safeEqual(await sign(payload), signature)) return null;

  try {
    const claims = JSON.parse(b64urlDecode(payload)) as SessionClaims;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Stable hex digest, used to key records by email without storing the email in a path. */
export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return toHex(new Uint8Array(digest));
}
