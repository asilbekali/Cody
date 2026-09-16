import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwner } from "@/lib/session";
import { ownerLogoutAction } from "@/app/actions/auth";

export const metadata = { robots: { index: false } };

/**
 * Real owner check for every studio page. proxy.ts only looks for the cookie's
 * presence; this verifies the signature and expiry.
 */
export default async function StudioLayout({ children }: LayoutProps<"/owner/studio">) {
  if (!(await getOwner())) redirect("/owner");

  return (
    <>
      <header className="navbar" data-scrolled="true">
        <div className="shell shell-wide navbar-inner">
          <Link href="/owner/studio" className="font-semibold tracking-tight pressable">
            Studio
          </Link>

          <nav className="flex items-center gap-3">
            <Link href="/owner/studio/members" className="nav-link text-[15px]">
              Members
            </Link>
            <Link href="/" className="nav-link text-[15px]">
              View blog
            </Link>
            <form action={ownerLogoutAction}>
              <button type="submit" className="btn btn-ghost" style={{ minHeight: 36 }}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="shell shell-wide flex-1 pt-8">{children}</main>
    </>
  );
}
