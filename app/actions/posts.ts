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

  const post = await createPost(input);
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

  const post = await updatePost(id, input);
  if (!post) return { error: "That post no longer exists." };

  revalidatePost(post.slug);
  redirect("/owner/studio");
}

export async function deletePostAction(formData: FormData) {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await clearPostSocial(id);
  await deletePost(id);
  revalidatePost();
  redirect("/owner/studio");
}
