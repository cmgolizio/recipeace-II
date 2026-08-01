import type { Metadata } from "next";
import type { ReactNode } from "react";

// The matches page itself is a client component (it reads the local pantry),
// so its metadata lives here.
export const metadata: Metadata = {
  title: "Kitchen matches — RecipeAce",
  description:
    "Food recipes ranked by how few ingredients you’re missing, from the pantry you already have.",
  alternates: { canonical: "/kitchen/matches" },
};

export default function KitchenMatchesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
