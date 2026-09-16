import { NextResponse, type NextRequest } from "next/server";
import { OWNER_COOKIE, MEMBER_COOKIE } from "@/lib/session";

/**
 * Optimistic route protection only — it checks that a session cookie is present,
 * not that it is valid. Real verification happens in the pages and Server Actions
 * themselves (see `requireOwner` / `requireMember`), which is where it has to be:
 * Server Actions can be invoked by direct POST without passing through here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/owner/studio")) {
    if (!request.cookies.get(OWNER_COOKIE)) {
      return NextResponse.redirect(new URL("/owner", request.url));
    }
  }

  if (pathname === "/me") {
    if (!request.cookies.get(MEMBER_COOKIE)) {
      const url = new URL("/signin", request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/me"],
};
