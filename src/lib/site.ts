/**
 * The product name, in one place.
 *
 * It has already changed once and is expected to change again, so nothing
 * hardcodes it: page titles, the manifest, the Open Graph image and the header
 * wordmark all read it from here. Changing the name is this one line plus the
 * README.
 *
 * Not covered by this constant, because they are not user-facing strings:
 * the `recipeace.*` localStorage keys (renaming them would discard every
 * anonymous pantry and shopping list), the `ihm-*` service-worker cache names,
 * and the repository name.
 *
 * See ./site-url.ts for the origin.
 */
export const SITE_NAME = "In House Mixers";

/** "The Bar — In House Mixers". Every page title is built through this. */
export function pageTitle(page: string): string {
  return `${page} — ${SITE_NAME}`;
}