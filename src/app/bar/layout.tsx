import type { ReactNode } from "react";

/**
 * A passthrough, for now. The Bar's accent used to be rebound here; ux-plan.md
 * D4 removes the domain accent, because random accents and domain-identity
 * accents are the same CSS variable and cannot coexist. The two sides are
 * distinguished by background, type scale, density and copy instead — this is
 * where that wrapper class will go.
 *
 * No metadata here on purpose: /bar owns its own, and /bar/matches has a layout
 * of its own carrying the matches page's (that page is a client component). A
 * title at this level would apply to any descendant that doesn't set one, which
 * is not this file's job.
 */
export default function BarLayout({ children }: { children: ReactNode }) {
  return children;
}