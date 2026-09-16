"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLikeAction, toggleBookmarkAction } from "@/app/actions/social";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 3c0 5.1-7.5 9.7-7.5 9.7Z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-3.8L5.5 20V5.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function SocialBar({
  postId,
  initialLikes,
  initialLiked,
  initialBookmarked,
  signedIn,
}: {
  postId: string;
  initialLikes: number;
  initialLiked: boolean;
  initialBookmarked: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [burst, setBurst] = useState(false);
  const [, startTransition] = useTransition();

  function requireAccount() {
    router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
  }

  function onLike() {
    if (!signedIn) return requireAccount();

    // Optimistic: flip immediately, reconcile with the server's count after.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes((n) => n + (nextLiked ? 1 : -1));
    if (nextLiked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 400);
    }

    startTransition(async () => {
      const result = await toggleLikeAction(postId);
      if (result.ok) {
        setLikes(result.count);
        setLiked(result.liked);
      } else {
        setLiked(!nextLiked);
        setLikes((n) => n + (nextLiked ? -1 : 1));
      }
    });
  }

  function onBookmark() {
    if (!signedIn) return requireAccount();

    const next = !bookmarked;
    setBookmarked(next);

    startTransition(async () => {
      const result = await toggleBookmarkAction(postId);
      if (result.ok) setBookmarked(result.bookmarked);
      else setBookmarked(!next);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onLike}
        className="btn btn-ghost btn-pill"
        style={{ color: liked ? "var(--danger)" : "var(--label-secondary)" }}
        aria-pressed={liked}
        aria-label={liked ? "Remove like" : "Like this post"}
      >
        <span className={burst ? "pop inline-flex" : "inline-flex"}>
          <HeartIcon filled={liked} />
        </span>
        <span className="text-[15px] tabular-nums">{likes}</span>
      </button>

      <button
        onClick={onBookmark}
        className="btn btn-ghost btn-pill"
        style={{ color: bookmarked ? "var(--accent)" : "var(--label-secondary)" }}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove from saved" : "Save for later"}
      >
        <BookmarkIcon filled={bookmarked} />
      </button>
    </div>
  );
}
