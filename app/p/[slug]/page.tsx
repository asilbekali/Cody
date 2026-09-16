import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug } from "@/lib/posts";
import { getLikes, getBookmarks, getComments } from "@/lib/social";
import { getMemberSession, getOwner } from "@/lib/session";
import { Markdown } from "@/lib/markdown";
import { formatDate, readingTime } from "@/lib/format";
import { NavBar } from "@/app/components/NavBar";
import { SocialBar } from "@/app/components/SocialBar";
import { Comments } from "@/app/components/Comments";

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  // Same visibility rule as the page: never leak a draft's title into a 404.
  if (!post || (post.status !== "published" && !(await getOwner()))) {
    return { title: "Not found" };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: post.cover?.kind === "image" ? [post.cover.url] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  // Drafts stay invisible to everyone but the owner previewing them.
  const owner = await getOwner();
  if (!post || (post.status !== "published" && !owner)) notFound();

  const member = await getMemberSession();
  const [likeIds, bookmarks, comments] = await Promise.all([
    getLikes(post.id),
    member ? getBookmarks(member.sub) : Promise.resolve<string[]>([]),
    getComments(post.id),
  ]);

  return (
    <>
      <NavBar title="Journal" memberName={member?.name ?? null} />

      <main className="shell flex-1 pb-24 pt-8">
        <Link href="/" className="nav-link mb-6 inline-flex items-center gap-1 text-[15px]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Journal
        </Link>

        <article className="fade-in">
          {post.status === "draft" ? (
            <p className="chip mb-4" style={{ color: "var(--danger)" }}>
              Draft — only you can see this
            </p>
          ) : null}

          <h1 className="large-title mb-3">{post.title}</h1>

          <div className="footnote mb-7 flex flex-wrap items-center gap-x-2">
            <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{readingTime(post.body)} min read</span>
          </div>

          {post.cover ? (
            <div
              className="relative mb-8 overflow-hidden rounded-[var(--radius-lg)]"
              style={{ background: "var(--fill)" }}
            >
              {post.cover.kind === "video" ? (
                <video src={post.cover.url} controls playsInline preload="metadata" className="w-full" />
              ) : (
                <Image
                  src={post.cover.url}
                  alt=""
                  width={1600}
                  height={900}
                  sizes="(max-width: 44rem) 100vw, 44rem"
                  className="h-auto w-full"
                  priority
                />
              )}
            </div>
          ) : null}

          <Markdown source={post.body} />

          {post.tags.length ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </article>

        <div className="hairline-top mt-8 flex items-center justify-between pt-4">
          <SocialBar
            postId={post.id}
            initialLikes={likeIds.length}
            initialLiked={member ? likeIds.includes(member.sub) : false}
            initialBookmarked={bookmarks.includes(post.id)}
            signedIn={Boolean(member)}
          />
          {owner ? (
            <Link href={`/owner/studio/edit/${post.id}`} className="nav-link text-[15px]">
              Edit
            </Link>
          ) : null}
        </div>

        <Comments
          postId={post.id}
          initialComments={comments}
          viewerId={member?.sub ?? null}
          viewerName={member?.name ?? null}
          isOwner={Boolean(owner)}
        />
      </main>
    </>
  );
}
