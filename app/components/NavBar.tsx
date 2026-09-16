"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { initials } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar({
  title,
  memberName,
  right,
}: {
  title: string;
  memberName?: string | null;
  right?: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  // The hairline under the bar only appears once content slides beneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="navbar" data-scrolled={scrolled}>
      <div className="shell navbar-inner">
        <Link href="/" className="pressable text-[19px] font-bold tracking-tight">
          {title}
        </Link>

        <nav className="flex items-center gap-2">
          {right}
          <ThemeToggle />
          {memberName ? (
            <Link
              href="/me"
              className="pressable ml-1 flex items-center gap-2"
              aria-label="Your profile"
            >
              <span className="avatar h-8 w-8 text-[13px]">{initials(memberName)}</span>
              {/* The name is hidden on narrow screens, where the avatar is the target. */}
              <span className="hidden max-w-[9rem] truncate text-[15px] font-medium sm:inline">
                {memberName}
              </span>
            </Link>
          ) : (
            <Link href="/signin" className="nav-link ml-1">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
