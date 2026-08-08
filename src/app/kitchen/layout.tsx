import type { ReactNode } from "react";

/**
 * The Kitchen's accent, rebound for the whole subtree (restructure-plan.md
 * 3.5). Metadata stays with the pages and with kitchen/matches/layout.tsx, for
 * the reasons in the Bar's copy of this file.
 */
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return <div className="domain-kitchen">{children}</div>;
}