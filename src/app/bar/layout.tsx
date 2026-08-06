import type { ReactNode } from "react";

/**
 * The Bar's accent, rebound for the whole subtree (restructure-plan.md 3.5).
 *
 * No metadata here on purpose: /bar owns its own, and /bar/matches has a layout
 * of its own carrying the matches page's (that page is a client component). A
 * title at this level would apply to any descendant that doesn't set one, which
 * is not this file's job.
 */
export default function BarLayout({ children }: { children: ReactNode }) {
  return <div className="domain-bar">{children}</div>;
}
