"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Comment } from "@/lib/types";
import { formatRelative, initials } from "@/lib/format";
import { addCommentAction, deleteCommentAction } from "@/app/actions/social";

export function Comments({
  postId,
  initialComments,
  viewerId,
  viewerName,
  isOwner,
}: {
  postId: string;
  initialComments: Comment[];
  viewerId: string | null;
  viewerName: string | null;
  isOwner: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setError(null);
    startTransition(async () => {
      const result = await addCommentAction(postId, text);
      if (result.ok) {
        setComments((list) => [...list, result.comment]);
        setDraft("");
      } else {
        setError(result.error);
      }
    });
  }

  function remove(commentId: string) {
    const previous = comments;
    setComments((list) => list.filter((c) => c.id !== commentId));

    startTransition(async () => {
      const result = await deleteCommentAction(postId, commentId);
      if (!result.ok) setComments(previous);
    });
  }

  return (
    <section className="mt-12">
      <h2 className="title-2 mb-4">
        {comments.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comments"}
      </h2>

      {viewerId ? (
        <form onSubmit={submit} className="card mb-6 p-4">
          <div className="flex gap-3">
            <span
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
              style={{ background: "var(--accent)" }}
              aria-hidden
            >
              {initials(viewerName ?? "?")}
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share a thought…"
              rows={3}
              maxLength={2000}
              className="input"
              style={{ border: "none", background: "transparent", padding: "6px 0", minHeight: 0 }}
            />
          </div>

          {error ? (
            <p className="footnote mt-2" style={{ color: "var(--danger)" }} role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary btn-pill"
              disabled={!draft.trim() || pending}
              style={{ minHeight: 38, fontSize: "0.9375rem" }}
            >
              {pending ? <span className="spinner" aria-hidden /> : null}
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <div className="card mb-6 p-5 text-center">
          <p className="secondary text-[15px]">
            Join to leave a comment — reading always stays open.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/join" className="btn btn-primary btn-pill">
              Create account
            </Link>
            <Link href="/signin" className="btn btn-secondary btn-pill">
              Sign in
            </Link>
          </div>
        </div>
      )}

      {comments.length ? (
        <ul className="group">
          {comments
            .slice()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((comment) => {
              const canDelete = isOwner || comment.authorId === viewerId;
              return (
                <li key={comment.id} className="fade-in flex gap-3 p-4">
                  <span
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
                    style={{ background: "var(--fill)", color: "var(--label-secondary)" }}
                    aria-hidden
                  >
                    {initials(comment.authorName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-semibold">{comment.authorName}</span>
                      <span className="footnote">{formatRelative(comment.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                      {comment.body}
                    </p>
                  </div>

                  {canDelete ? (
                    <button
                      onClick={() => remove(comment.id)}
                      className="btn btn-danger shrink-0"
                      style={{ minHeight: 32, padding: "0 8px", fontSize: "0.8125rem" }}
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="secondary text-center text-[15px]">No comments yet.</p>
      )}
    </section>
  );
}
