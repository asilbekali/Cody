import Link from "next/link";
import Image from "next/image";
import type { Post } from "@/lib/types";
import { formatDate, readingTime } from "@/lib/format";

export function PostCard({
  post,
  index = 0,
  featured = false,
  likes = 0,
  comments = 0,
}: {
  post: Post;
  index?: number;
  /** The lead card on the feed: bigger headline, eager cover. */
  featured?: boolean;
  likes?: number;
  comments?: number;
}) {
  return (
    <article className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link href={`/p/${post.slug}`} className="card pressable block">
        {post.cover ? (
          <div className="relative aspect-[16/9] w-full" style={{ background: "var(--fill)" }}>
            {post.cover.kind === "video" ? (
              <video
                src={post.cover.url}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <Image
                src={post.cover.url}
                alt=""
                fill
                sizes="(max-width: 44rem) 100vw, 44rem"
                className="object-cover"
                priority={featured || index === 0}
              />
            )}
          </div>
        ) : null}

        <div className="p-5">
          {post.status === "draft" ? (
            <span className="chip mb-3" style={{ color: "var(--danger)" }}>
              Draft
            </span>
          ) : null}

          <h2
            className="title-2 mb-1.5"
            style={featured ? { fontSize: "1.6rem" } : undefined}
          >
            {post.title}
          </h2>

          {post.excerpt ? (
            <p className="secondary line-clamp-3 text-[15px] leading-relaxed">
              {post.excerpt}
            </p>
          ) : null}

          <div className="footnote mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>{readingTime(post.body)} min read</span>
            {likes > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {likes} {likes === 1 ? "like" : "likes"}
                </span>
              </>
            ) : null}
            {comments > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {comments} {comments === 1 ? "comment" : "comments"}
                </span>
              </>
            ) : null}
          </div>

          {post.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
