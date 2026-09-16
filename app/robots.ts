import type { MetadataRoute } from "next";

/** Keeps the studio and account pages out of search results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/owner", "/owner/", "/me", "/api/"],
    },
  };
}
