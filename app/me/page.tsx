import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/session";
import { getMember } from "@/lib/members";
import { getBookmarks } from "@/lib/social";
import { getPost } from "@/lib/posts";
import type { Post } from "@/lib/types";
import { formatDate, initials } from "@/lib/format";
import { siteConfig } from "@/lib/config";
import { memberLogoutAction } from "@/app/actions/auth";
import { NavBar } from "@/app/components/NavBar";
import {
  ProfileDetailsForm,
  PasswordForm,
  DeleteAccountForm,
} from "@/app/components/ProfileForms";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function ProfilePage() {
  const session = await getMemberSession();
  if (!session) redirect("/signin?next=/me");

  // The cookie can outlive the account (deleted elsewhere), so read the record too.
  const member = await getMember(session.sub);
  if (!member) redirect("/signin?next=/me");

  const bookmarkIds = await getBookmarks(member.id);
  const saved = (await Promise.all(bookmarkIds.map((id) => getPost(id)))).filter(
    (post): post is Post => post !== null && post.status === "published"
  );

  return (
    <>
      <NavBar title={siteConfig.name} memberName={member.name} />

      <main className="shell flex-1 pb-24 pt-10">
        <header className="rise mb-9 flex items-center gap-4">
          <span className="avatar h-16 w-16 text-[22px]">{initials(member.name)}</span>
          <div className="min-w-0">
            <h1 className="title-2 truncate">{member.name}</h1>
            <p className="secondary truncate text-[15px]">{member.email}</p>
            <p className="footnote mt-0.5">Joined {formatDate(member.createdAt)}</p>
          </div>
        </header>

        <Section title="Account" index={1}>
          <ProfileDetailsForm name={member.name} email={member.email} />
        </Section>

        <Section title="Password" index={2}>
          <PasswordForm />
        </Section>

        <Section title="Saved posts" index={3}>
          {saved.length ? (
            <ul className="group" style={{ margin: "-4px 0" }}>
              {saved.map((post) => (
                <li key={post.id}>
                  <Link href={`/p/${post.slug}`} className="row row-tappable">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-medium">
                        {post.title}
                      </span>
                      <p className="footnote mt-0.5">
                        {formatDate(post.publishedAt ?? post.createdAt)}
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
            <p className="secondary text-[15px]">
              Nothing saved yet. Tap the bookmark on any post to keep it here.
            </p>
          )}
        </Section>

        <Section title="Danger zone" index={4}>
          <DeleteAccountForm />
        </Section>

        <form action={memberLogoutAction} className="rise mt-8" style={{ "--i": 5 } as React.CSSProperties}>
          <button type="submit" className="btn btn-secondary btn-pill">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}

function Section({
  title,
  index,
  children,
}: {
  title: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card rise mb-5 p-6" style={{ "--i": index } as React.CSSProperties}>
      <h2 className="footnote mb-4 uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  );
}
