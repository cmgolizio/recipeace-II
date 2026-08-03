import type { Metadata } from "next";
import { pageTitle } from "../../../lib/site";
import type { ReactNode } from "react";

// The matches page itself is a client component (it reads the local pantry),
// so its metadata lives here.
export const metadata: Metadata = {
  title: pageTitle("Bar matches"),
  description:
    "Cocktails ranked by how few ingredients you’re missing, from the pantry you already have.",
  alternates: { canonical: "/bar/matches" },
};

export default function BarMatchesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}