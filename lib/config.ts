/**
 * Branding and identity, sourced from environment variables so nothing
 * user-specific is hard-coded into the components.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Cody",
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ||
    "Writing, photographs and video — published as they happen.",
} as const;
