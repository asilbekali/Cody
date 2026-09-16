"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { createPostAction, updatePostAction, type EditorState } from "@/app/actions/posts";
import { Markdown } from "@/lib/markdown";
import { uploadMedia, mediaKind } from "./upload";
import type { Post } from "@/lib/types";

type Cover = Post["cover"];

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime";

export function Editor({ post, blobEnabled }: { post?: Post; blobEnabled: boolean }) {
  const editing = Boolean(post);
  const [state, action] = useActionState<EditorState, FormData>(
    editing ? updatePostAction : createPostAction,
    undefined
  );

  const [body, setBody] = useState(post?.body ?? "");
  const [cover, setCover] = useState<Cover>(post?.cover ?? null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const inlineInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  /** Inserts markdown at the caret and restores focus where the writer expects it. */
  function insert(snippet: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + snippet);
      return;
    }

    const { selectionStart: start, selectionEnd: end } = el;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);

    requestAnimationFrame(() => {
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  }

  /** Wraps the current selection, or drops in a placeholder when nothing is selected. */
  function wrap(before: string, after = before, placeholder = "text") {
    const el = bodyRef.current;
    if (!el) return;

    const { selectionStart: start, selectionEnd: end } = el;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function handleFiles(files: FileList | null, target: "body" | "cover") {
    const file = files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(`Uploading ${file.name}… 0%`);

    try {
      const url = await uploadMedia(file, blobEnabled, (pct) =>
        setUploading(`Uploading ${file.name}… ${Math.round(pct)}%`)
      );
      const kind = mediaKind(file);

      if (target === "cover") {
        setCover({ url, kind });
      } else {
        insert(
          kind === "video"
            ? `\n\n@[video](${url})\n\n`
            : `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n\n`
        );
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  return (
    <form action={action} className="pb-32">
      {editing ? <input type="hidden" name="id" value={post!.id} /> : null}
      <input type="hidden" name="body" value={body} />
      <input type="hidden" name="coverUrl" value={cover?.url ?? ""} />
      <input type="hidden" name="coverKind" value={cover?.kind ?? "image"} />

      <input
        name="title"
        defaultValue={post?.title ?? ""}
        placeholder="Title"
        required
        className="large-title w-full bg-transparent outline-none"
        style={{ border: "none", padding: 0 }}
      />

      {/* ---------------------------------------------------------------- cover */}
      <div className="mt-6">
        {cover ? (
          <div className="card relative overflow-hidden">
            {cover.kind === "video" ? (
              <video src={cover.url} className="w-full" controls playsInline preload="metadata" />
            ) : (
              <Image
                src={cover.url}
                alt=""
                width={1600}
                height={900}
                className="h-auto w-full"
                unoptimized
              />
            )}
            <button
              type="button"
              onClick={() => setCover(null)}
              className="btn absolute right-3 top-3"
              style={{
                minHeight: 34,
                padding: "0 14px",
                fontSize: "0.875rem",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                backdropFilter: "blur(12px)",
              }}
            >
              Remove cover
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="row row-tappable group justify-center"
            style={{ color: "var(--accent)" }}
          >
            Add a cover image or video
          </button>
        )}
        <input
          ref={coverInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files, "cover");
            e.target.value = "";
          }}
        />
      </div>

      {/* -------------------------------------------------------------- toolbar */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="segmented">
          <button type="button" data-active={tab === "write"} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" data-active={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>

        {tab === "write" ? (
          <div className="flex items-center gap-1">
            <ToolButton label="Heading" onClick={() => insert("\n## ")}>H</ToolButton>
            <ToolButton label="Bold" onClick={() => wrap("**")}>
              <strong>B</strong>
            </ToolButton>
            <ToolButton label="Italic" onClick={() => wrap("*")}>
              <em>i</em>
            </ToolButton>
            <ToolButton label="Quote" onClick={() => insert("\n> ")}>&ldquo;</ToolButton>
            <ToolButton label="List" onClick={() => insert("\n- ")}>•</ToolButton>
            <ToolButton
              label="Insert image or video"
              onClick={() => inlineInput.current?.click()}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="8.5" cy="9.5" r="1.5" />
                <path d="M4 17l4.5-4.5 4 3.5 3-2.5L20 17" />
              </svg>
            </ToolButton>
          </div>
        ) : null}

        <input
          ref={inlineInput}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files, "body");
            e.target.value = "";
          }}
        />
      </div>

      {/* ----------------------------------------------------------- write/preview */}
      <div className="mt-4">
        {tab === "write" ? (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Write your post…\n\nDrop in images and video with the picture button.\nMarkdown works: ## heading, **bold**, - list, > quote."}
            rows={18}
            className="input fade-in"
            style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
          />
        ) : (
          <div className="card fade-in p-6">
            {body.trim() ? (
              <Markdown source={body} />
            ) : (
              <p className="secondary text-center text-[15px]">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      {uploading ? (
        <p className="footnote mt-3 flex items-center gap-2" role="status">
          <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden />
          {uploading}
        </p>
      ) : null}

      {uploadError ? (
        <p className="footnote mt-3" style={{ color: "var(--danger)" }} role="alert">
          {uploadError}
        </p>
      ) : null}

      {/* ------------------------------------------------------------- metadata */}
      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-[15px] font-semibold">
          Teaser and tags
        </summary>

        <div className="mt-4 flex flex-col gap-3">
          <label className="footnote">
            Teaser — leave blank to use the opening lines
            <textarea
              name="excerpt"
              defaultValue={post?.excerpt ?? ""}
              rows={2}
              maxLength={300}
              className="input mt-1.5"
              style={{ fontSize: "0.9375rem" }}
            />
          </label>

          <label className="footnote">
            Tags — comma separated, up to six
            <input
              name="tags"
              defaultValue={post?.tags.join(", ") ?? ""}
              placeholder="photography, travel"
              className="input mt-1.5"
              style={{ fontSize: "0.9375rem" }}
            />
          </label>
        </div>
      </details>

      {state?.error ? (
        <p
          className="fade-in mt-5 rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px]"
          style={{ background: "rgba(255,59,48,0.1)", color: "var(--danger)" }}
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {/* --------------------------------------------------------- action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 hairline-top"
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "var(--nav-blur)",
          WebkitBackdropFilter: "var(--nav-blur)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="shell shell-wide flex items-center justify-between gap-3 py-3">
          <Link href="/owner/studio" className="nav-link">
            Cancel
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              name="status"
              value="draft"
              className="btn btn-secondary btn-pill"
              disabled={Boolean(uploading)}
            >
              Save draft
            </button>
            <button
              type="submit"
              name="status"
              value="published"
              className="btn btn-primary btn-pill"
              disabled={Boolean(uploading)}
            >
              {post?.status === "published" ? "Update" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ToolButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pressable grid h-9 w-9 place-items-center rounded-[10px] text-[15px]"
      style={{ background: "var(--fill)", color: "var(--label-secondary)" }}
    >
      {children}
    </button>
  );
}
