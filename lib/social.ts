import { readJSON, updateJSON, removeKey, listKeys } from "./store";
import type { Comment } from "./types";

const likesKey = (postId: string) => `data/likes/${postId}.json`;
const bookmarksKey = (memberId: string) => `data/bookmarks/${memberId}.json`;
const commentsKey = (postId: string) => `data/comments/${postId}.json`;

type Likes = { memberIds: string[] };
type Bookmarks = { postIds: string[] };
type Comments = { items: Comment[] };

/* -------------------------------- likes ---------------------------------- */

export async function getLikes(postId: string) {
  return (await readJSON<Likes>(likesKey(postId)))?.memberIds ?? [];
}

/** Returns the new like count and whether the member now likes the post. */
export async function toggleLike(postId: string, memberId: string) {
  const next = await updateJSON<Likes>(likesKey(postId), (current) => {
    const ids = current?.memberIds ?? [];
    return {
      memberIds: ids.includes(memberId)
        ? ids.filter((id) => id !== memberId)
        : [...ids, memberId],
    };
  });
  return { count: next.memberIds.length, liked: next.memberIds.includes(memberId) };
}

/** One read per post; used to decorate a whole feed at once. */
export async function getLikeSummary(postIds: string[], memberId: string | null) {
  const entries = await Promise.all(
    postIds.map(async (id) => {
      const ids = await getLikes(id);
      return [id, { count: ids.length, liked: memberId ? ids.includes(memberId) : false }] as const;
    })
  );
  return Object.fromEntries(entries) as Record<string, { count: number; liked: boolean }>;
}

/* ------------------------------ bookmarks -------------------------------- */

export async function getBookmarks(memberId: string) {
  return (await readJSON<Bookmarks>(bookmarksKey(memberId)))?.postIds ?? [];
}

export async function toggleBookmark(postId: string, memberId: string) {
  const next = await updateJSON<Bookmarks>(bookmarksKey(memberId), (current) => {
    const ids = current?.postIds ?? [];
    return {
      postIds: ids.includes(postId)
        ? ids.filter((id) => id !== postId)
        : [postId, ...ids],
    };
  });
  return { bookmarked: next.postIds.includes(postId) };
}

/* ------------------------------- comments -------------------------------- */

export async function getComments(postId: string): Promise<Comment[]> {
  const stored = await readJSON<Comments>(commentsKey(postId));
  return stored?.items ?? [];
}

export async function addComment(
  postId: string,
  authorId: string,
  authorName: string,
  body: string
): Promise<Comment> {
  const comment: Comment = {
    id: crypto.randomUUID(),
    postId,
    authorId,
    authorName,
    body: body.trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
  };

  await updateJSON<Comments>(commentsKey(postId), (current) => ({
    items: [...(current?.items ?? []), comment],
  }));

  return comment;
}

/**
 * Removes a comment. `requesterId` is checked unless the caller is the owner,
 * so a member can delete their own comment but nobody else's.
 */
export async function deleteComment(
  postId: string,
  commentId: string,
  requesterId: string | null
) {
  await updateJSON<Comments>(commentsKey(postId), (current) => ({
    items: (current?.items ?? []).filter((c) => {
      if (c.id !== commentId) return true;
      // Keep it if the requester isn't allowed to remove it.
      return requesterId !== null && c.authorId !== requesterId;
    }),
  }));
}

export async function countComments(postIds: string[]) {
  const entries = await Promise.all(
    postIds.map(async (id) => [id, (await getComments(id)).length] as const)
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

/** Every comment across the blog, newest first — powers the owner's moderation view. */
export async function listAllComments(): Promise<Comment[]> {
  const keys = await listKeys("data/comments/");
  const groups = await Promise.all(keys.map((key) => readJSON<Comments>(key)));
  return groups
    .flatMap((g) => g?.items ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearPostSocial(postId: string) {
  await removeKey(likesKey(postId)).catch(() => {});
  await removeKey(commentsKey(postId)).catch(() => {});
}
