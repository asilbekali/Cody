import Link from "next/link";
import { listMembers } from "@/lib/members";
import { listAllComments, getBookmarks } from "@/lib/social";
import { formatDate, formatRelative, initials } from "@/lib/format";

export const metadata = { title: "Members" };

export default async function StudioMembersPage() {
  const [members, comments] = await Promise.all([listMembers(), listAllComments()]);

  // One pass over every comment gives each member's count and last activity.
  const activity = new Map<string, { count: number; lastAt: string }>();
  for (const comment of comments) {
    const current = activity.get(comment.authorId);
    activity.set(comment.authorId, {
      count: (current?.count ?? 0) + 1,
      // listAllComments is already newest-first, so the first one seen is the latest.
      lastAt: current?.lastAt ?? comment.createdAt,
    });
  }

  const saved = await Promise.all(
    members.map(async (member) => (await getBookmarks(member.id)).length)
  );

  return (
    <div className="pb-24">
      <Link href="/owner/studio" className="nav-link mb-6 inline-block text-[15px]">
        &lsaquo; Studio
      </Link>

      <h1 className="large-title rise mb-2">Members</h1>
      <p className="secondary rise mb-8 text-[15px]" style={{ "--i": 1 } as React.CSSProperties}>
        {members.length
          ? `${members.length} ${members.length === 1 ? "person has" : "people have"} an account. They can read, like, save and comment — nothing else.`
          : "Nobody has signed up yet."}
      </p>

      {members.length ? (
        <ul className="group rise" style={{ "--i": 2 } as React.CSSProperties}>
          {members.map((member, i) => {
            const seen = activity.get(member.id);
            return (
              <li key={member.id} className="row">
                <span className="avatar h-10 w-10 text-[14px]">{initials(member.name)}</span>

                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{member.name}</span>
                  <span className="footnote block truncate">{member.email}</span>
                  <p className="footnote mt-0.5">
                    Joined {formatDate(member.createdAt)}
                    {seen ? ` · last comment ${formatRelative(seen.lastAt)}` : ""}
                  </p>
                </div>

                <div className="footnote shrink-0 text-right tabular-nums">
                  <div>
                    {seen?.count ?? 0} {seen?.count === 1 ? "comment" : "comments"}
                  </div>
                  <div>
                    {saved[i]} saved
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card rise p-10 text-center">
          <p className="secondary text-[15px]">
            Accounts appear here as soon as readers sign up.
          </p>
        </div>
      )}
    </div>
  );
}
