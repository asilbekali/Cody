"use client";

import { useEffect, useState } from "react";

/**
 * Uses the native share sheet where the browser offers one (iOS, Android),
 * and falls back to an iOS-style action sheet with copy / X / WhatsApp / email.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.origin + path);
  }, [path]);

  // Escape closes the sheet, matching the dismiss gesture.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported — fall through to the sheet.
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        onClick={share}
        className="btn btn-ghost btn-pill"
        style={{ color: "var(--label-secondary)" }}
        aria-label="Share this post"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15V3.5M12 3.5 8.5 7M12 3.5 15.5 7" />
          <path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" />
        </svg>
      </button>

      {open ? (
        <>
          <div className="scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="action-sheet" role="dialog" aria-modal="true" aria-label="Share">
            <div className="action-sheet-inner">
              <div className="grabber" aria-hidden />

              <div className="group mb-2">
                <button className="row row-tappable" onClick={copy}>
                  {copied ? "Link copied" : "Copy link"}
                </button>
                <a
                  className="row row-tappable"
                  href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on X
                </a>
                <a
                  className="row row-tappable"
                  href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on WhatsApp
                </a>
                <a
                  className="row row-tappable"
                  href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`}
                >
                  Email
                </a>
              </div>

              <div className="group">
                <button
                  className="row row-tappable"
                  style={{ fontWeight: 600 }}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
