"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  signInOwner,
  signOutOwner,
  signInMember,
  signOutMember,
  ownerCredentialsConfigured,
} from "@/lib/session";
import {
  registerMember,
  authenticateMember,
  updateMemberProfile,
  changeMemberPassword,
  deleteMemberAccount,
} from "@/lib/members";
import { getMemberSession } from "@/lib/session";

export type FormState = { error?: string } | undefined;

/** Only same-site relative paths may be used as a post-login destination. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/* --------------------------------- owner --------------------------------- */

export async function ownerLoginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!ownerCredentialsConfigured()) {
    return {
      error:
        "OWNER_USERNAME and OWNER_PASSWORD are not set. Add them in your Vercel project settings (or .env.local) and reload.",
    };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  if (!(await signInOwner(username, password))) {
    // Deliberately vague: never reveal which half was wrong.
    return { error: "Those credentials are not correct." };
  }

  redirect("/owner/studio");
}

export async function ownerLogoutAction() {
  await signOutOwner();
  redirect("/owner");
}

/* --------------------------------- member -------------------------------- */

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await registerMember(name, email, password);
  if (!result.ok) return { error: result.error };

  await signInMember(result.member.id, result.member.name);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signInAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const member = await authenticateMember(email, password);
  if (!member) return { error: "Email or password is incorrect." };

  await signInMember(member.id, member.name);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function memberLogoutAction() {
  await signOutMember();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ---------------------------- member profile ----------------------------- */

export type ProfileState = { error?: string; success?: string } | undefined;

/** Updates the signed-in member's display name and email. */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getMemberSession();
  if (!session) return { error: "You are not signed in." };

  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");

  const result = await updateMemberProfile(session.sub, name, email);
  if (!result.ok) return { error: result.error };

  // The display name lives in the session cookie, so re-issue it.
  await signInMember(result.member.id, result.member.name);
  revalidatePath("/", "layout");
  return { success: "Profile updated." };
}

export async function changePasswordAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getMemberSession();
  if (!session) return { error: "You are not signed in." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next !== confirm) return { error: "The new passwords don't match." };

  const result = await changeMemberPassword(session.sub, current, next);
  if (!result.ok) return { error: result.error };

  return { success: "Password changed." };
}

export async function deleteAccountAction(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await getMemberSession();
  if (!session) return { error: "You are not signed in." };

  const password = String(formData.get("password") ?? "");
  const result = await deleteMemberAccount(session.sub, password);
  if (!result.ok) return { error: result.error };

  await signOutMember();
  revalidatePath("/", "layout");
  redirect("/");
}
