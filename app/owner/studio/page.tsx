import Link from "next/link";
import { listPosts } from "@/lib/posts";
import { countMembers } from "@/lib/members";
import { listAllComments, getLikeSummary } from "@/lib/social";
import { hasBlobStore, storageUnavailable } from "@/lib/store";
import { formatDate } from "@/lib/format";

export default async function StudioPage() {
  const [posts, members, comments] = await Promise.all([
    listPosts(),
    countMembers(),
    listAllComments(),
  ]);

  const likes = await getLikeSummary(posts.map((p) => p.id), null);
  const totalLikes = Object.values(likes).reduce((sum, l) => sum + l.count, 0);
  const published = posts.filter((p) => p.status === "published").length;

  return (
    <div className="pb-24">
      <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="large-title">Your posts</h1>
        <Link href="/owner/studio/new" className="btn btn-primary btn-pill">
          New post
        </Link>
      </div>

      {storageUnavailable() ? (
        <div
          className="rise mb-6 rounded-[var(--radius)] px-4 py-3 text-[14px]"
          style={{ background: "rgba(255,59,48,0.12)", color: "var(--label)" }}
        >
          <strong>Nothing can be saved.</strong> This deployment has no Blob store, and
          its filesystem is read-only. In Vercel open <strong>Storage → Create Database
          → Blob</strong>, connect it to this project, then redeploy.
        </div>
      ) : !hasBlobStore() ? (
        <div
          className="rise mb-6 rounded-[var(--radius)] px-4 py-3 text-[14px]"
          style={{ background: "rgba(255,149,0,0.12)", color: "var(--label)" }}
        >
          <strong>Local mode.</strong> No blob store is connected, so posts and uploads
          are saved to <code>.data-dev/</code> and <code>public/uploads/</code> on this
          machine only. Connect a Vercel Blob store to publish for real.
        </div>
      ) : null}

      <div className="rise mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ "--i": 1 } as React.CSSProperties}>
        <Stat label="Published" value={published} />
        <Stat label="Drafts" value={posts.length - published} />
        <Stat label="Members" value={members} href="/owner/studio/members" />
        <Stat label="Likes" value={totalLikes} />
      </div>

      {comments.length ? (
        <Link
          href="/owner/studio/comments"
          className="card row row-tappable rise mb-8 justify-between"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <span className="text-[15px] font-medium">Comments</span>
          <span className="footnote">{comments.length} total &rsaquo;</span>
        </Link>
      ) : null}

      {posts.length ? (
        <ul className="group rise" style={{ "--i": 3 } as React.CSSProperties}>
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/owner/studio/edit/${post.id}`} className="row row-tappable">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-medium">{post.title}</span>
                    {post.status === "draft" ? (
                      <span
                        className="chip shrink-0"
                        style={{ background: "var(--fill)", color: "var(--danger)", padding: "2px 8px" }}
                      >
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <p className="footnote mt-0.5">
                    {formatDate(post.publishedAt ?? post.createdAt)}
                    {likes[post.id]?.count ? ` · ${likes[post.id].count} likes` : ""}
                  </p>
                </div>
                <span className="secondary shrink-0" aria-hidden>
                  &rsaquo;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card rise p-10 text-center">
          <p className="secondary text-[15px]">
            Nothing here yet. Write your first post and it appears on the blog the
            moment you publish.
          </p>
          <Link href="/owner/studio/new" className="btn btn-primary btn-pill mt-5">
            Write the first post
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  /** When given, the tile becomes a link into the matching detail page. */
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[1.75rem] font-semibold tabular-nums leading-none tracking-tight">
        {value}
      </p>
      <p className="footnote mt-1.5">
        {label}
        {href ? <span aria-hidden> &rsaquo;</span> : null}
      </p>
    </>
  );

  return href ? (
    <Link href={href} className="card pressable block p-4">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}
