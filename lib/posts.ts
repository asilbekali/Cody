import { readJSON, writeJSON, removeKey, readAllJSON, listKeys } from "./store";
import type { Post } from "./types";

const POSTS_PREFIX = "data/posts/";
const postKey = (id: string) => `${POSTS_PREFIX}${id}.json`;
const slugKey = (slug: string) => `data/slugs/${slug}.json`;

export function slugify(input: string) {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return base || "post";
}

/** Strips markdown noise so the feed teaser reads as plain prose. */
export function deriveExcerpt(body: string, max = 180) {
  const text = body
    .replace(/^@\[video\]\(.*?\)$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(" ", max) || max).trimEnd() + "…";
}

export async function listPosts(): Promise<Post[]> {
  const posts = await readAllJSON<Post>(POSTS_PREFIX);
  return posts.sort((a, b) => {
    const at = a.publishedAt ?? a.createdAt;
    const bt = b.publishedAt ?? b.createdAt;
    return bt.localeCompare(at);
  });
}

export async function listPublishedPosts(): Promise<Post[]> {
  return (await listPosts()).filter((p) => p.status === "published");
}

export async function getPost(id: string): Promise<Post | null> {
  return readJSON<Post>(postKey(id));
}

/** Slug -> id pointers let a reader's URL stay stable and resolve in one lookup. */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const pointer = await readJSON<{ id: string }>(slugKey(slug));
  if (!pointer) return null;
  return getPost(pointer.id);
}

async function uniqueSlug(desired: string, selfId: string | null) {
  let slug = desired;
  let n = 2;
  for (;;) {
    const pointer = await readJSON<{ id: string }>(slugKey(slug));
    if (!pointer || pointer.id === selfId) return slug;
    slug = `${desired}-${n++}`;
  }
}

export type PostInput = {
  title: string;
  body: string;
  excerpt?: string;
  cover?: Post["cover"];
  tags?: string[];
  status: Post["status"];
};

export async function createPost(input: PostInput): Promise<Post> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(slugify(input.title), id);

  const post: Post = {
    id,
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || deriveExcerpt(input.body),
    body: input.body,
    cover: input.cover ?? null,
    tags: input.tags ?? [],
    status: input.status,
    createdAt: now,
    updatedAt: now,
    publishedAt: input.status === "published" ? now : null,
  };

  await writeJSON(postKey(id), post);
  await writeJSON(slugKey(slug), { id });
  return post;
}

export async function updatePost(id: string, input: PostInput): Promise<Post | null> {
  const existing = await getPost(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const slug = await uniqueSlug(slugify(input.title), id);

  const post: Post = {
    ...existing,
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || deriveExcerpt(input.body),
    body: input.body,
    cover: input.cover ?? null,
    tags: input.tags ?? [],
    status: input.status,
    updatedAt: now,
    // First time it goes live, stamp the publish date; later edits keep it.
    publishedAt:
      input.status === "published" ? existing.publishedAt ?? now : null,
  };

  await writeJSON(postKey(id), post);
  if (slug !== existing.slug) {
    await removeKey(slugKey(existing.slug)).catch(() => {});
  }
  await writeJSON(slugKey(slug), { id });
  return post;
}

export async function deletePost(id: string) {
  const post = await getPost(id);
  if (!post) return;
  await removeKey(postKey(id)).catch(() => {});
  await removeKey(slugKey(post.slug)).catch(() => {});
  await removeKey(`data/likes/${id}.json`).catch(() => {});
  await removeKey(`data/comments/${id}.json`).catch(() => {});
}

export async function countPosts() {
  return (await listKeys(POSTS_PREFIX)).length;
}
