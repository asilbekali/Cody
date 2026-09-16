export type MediaKind = "image" | "video";

export type Post = {
  id: string;
  slug: string;
  title: string;
  /** Short teaser shown on the feed. Derived from the body when left blank. */
  excerpt: string;
  /** Markdown-ish body. See lib/markdown.tsx for the supported subset. */
  body: string;
  /** Optional hero image/video shown at the top of the post and on its feed card. */
  cover: { url: string; kind: MediaKind } | null;
  tags: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type Member = {
  id: string;
  email: string;
  name: string;
  /** PBKDF2 `salt:hash`. Never leaves the server. */
  passwordHash: string;
  createdAt: string;
};

/** A member as it is safe to expose to the client. */
export type PublicMember = Pick<Member, "id" | "name" | "email" | "createdAt">;

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};
