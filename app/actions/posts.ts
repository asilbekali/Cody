"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import {
  createPost,
  updatePost,
  deletePost,
  type PostInput,
} from "@/lib/posts";
import { clearPostSocial } from "@/lib/social";
import type { MediaKind } from "@/lib/types";

export type EditorState = { error?: string; ok?: boolean } | undefined;

/**
 * Storage failures (most often: no Blob store connected to the deployment) reach
 * the editor as a message instead of an unhandled 500, so the cause is visible
 * where the mistake can actually be fixed.
 */
function storageError(error: unknown): { error: string } {
  console.error("[studio] storage write failed", error);
  return {
    error:
      error instanceof Error ? error.message : "Could not save. Please try again.",
  };
}

function readInput(formData: FormData): PostInput | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const excerpt = String(formData.get("excerpt") ?? "");
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  const coverKind = String(formData.get("coverKind") ?? "image") as MediaKind;
  const status = formData.get("status") === "published" ? "published" : "draft";

  if (!title) return { error: "Give your post a title." };
  if (!body.trim()) return { error: "Write something before saving." };

  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  return {
    title,
    body,
    excerpt,
    tags,
    status,
    cover: coverUrl ? { url: coverUrl, kind: coverKind } : null,
  };
}

/** Refreshes every surface a post appears on, so readers see it immediately. */
function revalidatePost(slug?: string) {
  revalidatePath("/");
  revalidatePath("/owner/studio");
  revalidatePath("/me");
  if (slug) revalidatePath(`/p/${slug}`);
}

export async function createPostAction(
  _prev: EditorState,
  formData: FormData
): Promise<EditorState> {
  await requireOwner();

  const input = readInput(formData);
  if ("error" in input) return { error: input.error };

  let post;
  try {
    post = await createPost(input);
  } catch (error) {
    // Outside the try: redirect() below signals by throwing, and must not be caught.
    return storageError(error);
  }

  revalidatePost(post.slug);
  redirect("/owner/studio");
}

export async function updatePostAction(
  _prev: EditorState,
  formData: FormData
): Promise<EditorState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing post id." };

  const input = readInput(formData);
  if ("error" in input) return { error: input.error };

  let post;
  try {
    post = await updatePost(id, input);
  } catch (error) {
    return storageError(error);
  }
  if (!post) return { error: "That post no longer exists." };

  revalidatePost(post.slug);
  redirect("/owner/studio");
}

export async function deletePostAction(formData: FormData) {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await clearPostSocial(id);
    await deletePost(id);
  } catch (error) {
    console.error("[studio] delete failed", error);
    return;
  }

  revalidatePost();
  redirect("/owner/studio");
}
