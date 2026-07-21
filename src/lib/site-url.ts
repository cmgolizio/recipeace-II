/**
 * Absolute origin for everything that needs a fully qualified URL:
 * metadataBase, canonical tags, the share button, sitemap, and robots.
 * Set NEXT_PUBLIC_SITE_URL in the deploy environment (e.g.
 * https://inhousemixes.vercel.app); local dev falls back to the dev server.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";