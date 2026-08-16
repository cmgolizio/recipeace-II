import type { ReactNode } from "react";

/**
 * A passthrough, for now — see the Bar's copy of this file for why the domain
 * accent is gone (ux-plan.md D4) and what takes its place here. Metadata stays
 * with the pages and with kitchen/matches/layout.tsx.
 */
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return children;
}