"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCommentAction } from "@/app/actions/social";

export function DeleteCommentButton({
  postId,
  commentId,
}: {
  postId: string;
  commentId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn btn-danger"
        style={{ minHeight: 30, padding: "0 8px", fontSize: "0.8125rem" }}
      >
        Delete
      </button>
    );
  }

  return (
    <span className="fade-in flex items-center gap-1">
      <button
        onClick={() =>
          startTransition(async () => {
            await deleteCommentAction(postId, commentId);
            router.refresh();
          })
        }
        disabled={pending}
        className="btn btn-danger"
        style={{ minHeight: 30, padding: "0 8px", fontSize: "0.8125rem" }}
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="btn btn-ghost"
        style={{ minHeight: 30, padding: "0 8px", fontSize: "0.8125rem" }}
      >
        Cancel
      </button>
    </span>
  );
}
