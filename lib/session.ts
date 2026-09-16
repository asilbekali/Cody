import { cookies } from "next/headers";
import { createToken, verifyToken, safeEqual, type SessionClaims } from "./crypto";

export const OWNER_COOKIE = "blog_owner";
export const MEMBER_COOKIE = "blog_member";

const OWNER_TTL = 60 * 60 * 12; // 12 hours
const MEMBER_TTL = 60 * 60 * 24 * 30; // 30 days

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/* ------------------------------- owner ---------------------------------- */

export function ownerCredentialsConfigured() {
  return Boolean(process.env.OWNER_USERNAME && process.env.OWNER_PASSWORD);
}

export function ownerName() {
  return process.env.OWNER_USERNAME || "Owner";
}

/**
 * Checks the submitted credentials against OWNER_USERNAME / OWNER_PASSWORD.
 * Both comparisons run every time so a wrong username and a wrong password
 * take the same amount of work.
 */
export async function signInOwner(
  username: string,
  password: string
): Promise<boolean> {
  const expectedUser = process.env.OWNER_USERNAME;
  const expectedPassword = process.env.OWNER_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;

  const userOk = safeEqual(username, expectedUser);
  const passwordOk = safeEqual(password, expectedPassword);
  if (!userOk || !passwordOk) return false;

  const token = await createToken(
    { sub: "owner", role: "owner", name: expectedUser },
    OWNER_TTL
  );
  (await cookies()).set(OWNER_COOKIE, token, cookieOptions(OWNER_TTL));
  return true;
}

export async function getOwner(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  const claims = await verifyToken(token);
  return claims?.role === "owner" ? claims : null;
}

export async function signOutOwner() {
  (await cookies()).delete(OWNER_COOKIE);
}

/**
 * Use at the top of every owner-only Server Action and page.
 * Server Actions are reachable by direct POST, so the check cannot live in proxy.ts alone.
 */
export async function requireOwner(): Promise<SessionClaims> {
  const owner = await getOwner();
  if (!owner) throw new Error("Unauthorized");
  return owner;
}

/* ------------------------------- member --------------------------------- */

export async function signInMember(id: string, name: string) {
  const token = await createToken({ sub: id, role: "member", name }, MEMBER_TTL);
  (await cookies()).set(MEMBER_COOKIE, token, cookieOptions(MEMBER_TTL));
}

export async function getMemberSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  const claims = await verifyToken(token);
  return claims?.role === "member" ? claims : null;
}

export async function signOutMember() {
  (await cookies()).delete(MEMBER_COOKIE);
}

export async function requireMember(): Promise<SessionClaims> {
  const member = await getMemberSession();
  if (!member) throw new Error("You need to be signed in to do that.");
  return member;
}
