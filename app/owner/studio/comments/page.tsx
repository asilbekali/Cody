import Link from "next/link";
import { listAllComments } from "@/lib/social";
import { listPosts } from "@/lib/posts";
import { formatRelative } from "@/lib/format";
import { DeleteCommentButton } from "@/app/components/DeleteCommentButton";

export default async function StudioCommentsPage() {
  const [comments, posts] = await Promise.all([listAllComments(), listPosts()]);
  const titleById = new Map(posts.map((p) => [p.id, { title: p.title, slug: p.slug }]));

  return (
    <div className="pb-24">
      <Link href="/owner/studio" className="nav-link mb-6 inline-block text-[15px]">
        &lsaquo; Studio
      </Link>

      <h1 className="large-title rise mb-8">Comments</h1>

      {comments.length ? (
        <ul className="group rise">
          {comments.map((comment) => {
            const post = titleById.get(comment.postId);
            return (
              <li key={comment.id} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold">{comment.authorName}</span>
                  <span className="footnote shrink-0">{formatRelative(comment.createdAt)}</span>
                </div>

                <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {comment.body}
                </p>

                <div className="mt-2.5 flex items-center justify-between gap-3">
                  {post ? (
                    <Link href={`/p/${post.slug}`} className="footnote" style={{ color: "var(--accent)" }}>
                      on &ldquo;{post.title}&rdquo;
                    </Link>
                  ) : (
                    <span className="footnote">on a deleted post</span>
                  )}
                  <DeleteCommentButton postId={comment.postId} commentId={comment.id} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card p-10 text-center">
          <p className="secondary text-[15px]">No comments yet.</p>
        </div>
      )}
    </div>
  );
}
