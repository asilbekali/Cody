import Link from "next/link";
import { listPublishedPosts } from "@/lib/posts";
import { getLikeSummary, countComments } from "@/lib/social";
import { getMemberSession } from "@/lib/session";
import { siteConfig } from "@/lib/config";
import { NavBar } from "./components/NavBar";
import { PostCard } from "./components/PostCard";

export default async function HomePage() {
  const member = await getMemberSession();
  const posts = await listPublishedPosts();

  const ids = posts.map((p) => p.id);
  const [likes, comments] = await Promise.all([
    getLikeSummary(ids, member?.sub ?? null),
    countComments(ids),
  ]);

  const [lead, ...rest] = posts;

  return (
    <>
      <NavBar title={siteConfig.name} memberName={member?.name ?? null} />

      <main className="shell flex-1 pb-24 pt-10">
        <header className="rise mb-9">
          <h1 className="large-title">{siteConfig.name}</h1>
          <p className="secondary mt-2 text-[17px]">
            {posts.length ? siteConfig.description : "Nothing published yet."}
          </p>
          {member ? (
            <p className="footnote mt-3">Welcome back, {member.name}.</p>
          ) : null}
        </header>

        {posts.length ? (
          <div className="flex flex-col gap-5">
            <PostCard
              post={lead}
              index={0}
              featured
              likes={likes[lead.id]?.count ?? 0}
              comments={comments[lead.id] ?? 0}
            />

            {rest.length ? (
              <h2 className="footnote rise mt-6 uppercase tracking-wider" style={{ "--i": 1 } as React.CSSProperties}>
                More posts
              </h2>
            ) : null}

            {rest.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                index={i + 2}
                likes={likes[post.id]?.count ?? 0}
                comments={comments[post.id] ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="card rise p-10 text-center">
            <p className="secondary text-[15px]">
              The first post will appear here the moment it&rsquo;s published.
            </p>
          </div>
        )}



        {!member && posts.length ? (
          <section className="card rise mt-10 p-7 text-center">
            <h2 className="title-2">Join {siteConfig.name}</h2>
            <p className="secondary mx-auto mt-2 max-w-sm text-[15px]">
              Reading is always free. An account lets you like posts, save them for
              later and join the conversation.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Link href="/join" className="btn btn-primary btn-pill">
                Create account
              </Link>
              <Link href="/signin" className="btn btn-secondary btn-pill">
                Sign in
              </Link>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="hairline-top py-8">
        <div className="shell footnote flex items-center justify-between">
          <span>
            © {new Date().getUTCFullYear()} {siteConfig.name}
          </span>
          <span>Free to read</span>
        </div>
      </footer>
    </>
  );
}
