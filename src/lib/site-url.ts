/**
 * Absolute origin for everything that needs a fully qualified URL:
 * metadataBase, canonical tags, the share button, sitemap, and robots.
 *
 * A constant, not an environment variable. The canonical origin is a property
 * of the site, not of the machine building it, and holding it in a deploy
 * dashboard is what let production keep emitting a dead domain long after the
 * rename (docs/ux-plan.md audit finding 7). One source of truth, in the repo,
 * reviewable in a diff.
 *
 * NODE_ENV is the only branch: `next dev` serves from localhost, every built
 * deploy serves the real site. Preview deploys resolving to the production
 * origin is intended — a preview should canonicalise to production, not to
 * its own throwaway URL.
 */
export const siteUrl =
  process.env.NODE_ENV === "production"
    ? "https://whatsinhouse.vercel.app"
    : "http://localhost:3000";
