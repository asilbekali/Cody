"use server";

import { revalidatePath } from "next/cache";
import { getMemberSession, getOwner } from "@/lib/session";
import {
  toggleLike,
  toggleBookmark,
  addComment,
  deleteComment,
} from "@/lib/social";
import { getPost } from "@/lib/posts";

export type SocialResult = { ok: boolean; error?: string };

export async function toggleLikeAction(postId: string) {
  const member = await getMemberSession();
  if (!member) return { ok: false as const, error: "Sign in to like posts." };

  const result = await toggleLike(postId, member.sub);
  return { ok: true as const, ...result };
}

export async function toggleBookmarkAction(postId: string) {
  const member = await getMemberSession();
  if (!member) return { ok: false as const, error: "Sign in to save posts." };

  const result = await toggleBookmark(postId, member.sub);
  revalidatePath("/me");
  return { ok: true as const, ...result };
}

export async function addCommentAction(postId: string, body: string) {
  const member = await getMemberSession();
  if (!member) return { ok: false as const, error: "Sign in to comment." };

  const text = body.trim();
  if (!text) return { ok: false as const, error: "Write something first." };
  if (text.length > 2000)
    return { ok: false as const, error: "Comments are limited to 2000 characters." };

  const post = await getPost(postId);
  if (!post) return { ok: false as const, error: "That post no longer exists." };

  const comment = await addComment(postId, member.sub, member.name ?? "Member", text);
  revalidatePath(`/p/${post.slug}`);
  return { ok: true as const, comment };
}

/**
 * The owner can remove any comment; a member can remove only their own.
 * Authorization is resolved here, never trusted from the client.
 */
export async function deleteCommentAction(postId: string, commentId: string) {
  const owner = await getOwner();
  const member = await getMemberSession();

  if (!owner && !member) return { ok: false as const, error: "Not allowed." };

  await deleteComment(postId, commentId, owner ? null : member!.sub);

  const post = await getPost(postId);
  if (post) revalidatePath(`/p/${post.slug}`);
  revalidatePath("/owner/studio/comments");
  return { ok: true as const };
}
