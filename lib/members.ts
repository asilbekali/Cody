import { readJSON, writeJSON, removeKey, listKeys, readAllJSON } from "./store";
import { hashPassword, verifyPassword, sha256Hex } from "./crypto";
import type { Member, PublicMember } from "./types";

const MEMBERS_PREFIX = "data/members/";
const memberKey = (id: string) => `${MEMBERS_PREFIX}${id}.json`;

/** Emails are hashed into the lookup path so no address is readable from a blob listing. */
async function emailKey(email: string) {
  return `data/emails/${await sha256Hex(email.trim().toLowerCase())}.json`;
}

export function toPublicMember(member: Member): PublicMember {
  const { id, name, email, createdAt } = member;
  return { id, name, email, createdAt };
}

export async function getMember(id: string): Promise<Member | null> {
  return readJSON<Member>(memberKey(id));
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const pointer = await readJSON<{ id: string }>(await emailKey(email));
  if (!pointer) return null;
  return getMember(pointer.id);
}

export type RegisterResult =
  | { ok: true; member: Member }
  | { ok: false; error: string };

export async function registerMember(
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (cleanName.length < 2) return { ok: false, error: "Please enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
    return { ok: false, error: "That email address doesn't look right." };
  if (password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  if (await getMemberByEmail(cleanEmail))
    return { ok: false, error: "An account with that email already exists." };

  const member: Member = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: cleanName,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  await writeJSON(memberKey(member.id), member);
  await writeJSON(await emailKey(cleanEmail), { id: member.id });
  return { ok: true, member };
}

export async function authenticateMember(
  email: string,
  password: string
): Promise<Member | null> {
  const member = await getMemberByEmail(email);
  if (!member) {
    // Burn comparable time so a missing account can't be told apart by response speed.
    await hashPassword(password);
    return null;
  }
  return (await verifyPassword(password, member.passwordHash)) ? member : null;
}

export async function countMembers() {
  return (await listKeys(MEMBERS_PREFIX)).length;
}

/**
 * Every member, newest first. Mapped through `toPublicMember` so a password
 * hash can never reach a page or the client, even by accident.
 */
export async function listMembers(): Promise<PublicMember[]> {
  const members = await readAllJSON<Member>(MEMBERS_PREFIX);
  return members
    .map(toPublicMember)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* --------------------------- account management --------------------------- */

export type UpdateResult =
  | { ok: true; member: Member }
  | { ok: false; error: string };

/** Changes display name and/or email, keeping the email->id pointer in sync. */
export async function updateMemberProfile(
  id: string,
  name: string,
  email: string
): Promise<UpdateResult> {
  const member = await getMember(id);
  if (!member) return { ok: false, error: "Account not found." };

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) return { ok: false, error: "Please enter your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
    return { ok: false, error: "That email address doesn't look right." };

  if (cleanEmail !== member.email) {
    const taken = await getMemberByEmail(cleanEmail);
    if (taken && taken.id !== id)
      return { ok: false, error: "That email is already in use." };
  }

  const updated: Member = { ...member, name: cleanName, email: cleanEmail };
  await writeJSON(memberKey(id), updated);

  if (cleanEmail !== member.email) {
    await writeJSON(await emailKey(cleanEmail), { id });
    await removeKey(await emailKey(member.email)).catch(() => {});
  }

  return { ok: true, member: updated };
}

export async function changeMemberPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<UpdateResult> {
  const member = await getMember(id);
  if (!member) return { ok: false, error: "Account not found." };

  if (!(await verifyPassword(currentPassword, member.passwordHash)))
    return { ok: false, error: "Your current password is not correct." };

  if (newPassword.length < 8)
    return { ok: false, error: "New password must be at least 8 characters." };

  const updated: Member = { ...member, passwordHash: await hashPassword(newPassword) };
  await writeJSON(memberKey(id), updated);
  return { ok: true, member: updated };
}

/** Removes the account, its email pointer and its saved posts. Requires the password. */
export async function deleteMemberAccount(
  id: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await getMember(id);
  if (!member) return { ok: false, error: "Account not found." };

  if (!(await verifyPassword(password, member.passwordHash)))
    return { ok: false, error: "Password is not correct." };

  await removeKey(memberKey(id)).catch(() => {});
  await removeKey(await emailKey(member.email)).catch(() => {});
  await removeKey(`data/bookmarks/${id}.json`).catch(() => {});
  return { ok: true };
}
