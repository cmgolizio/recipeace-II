import type { Metadata } from "next";
import Link from "next/link";

import { AuthMessage } from "../../components/auth-message";
import { IngredientBrowse } from "../../components/ingredient-browse";
import { IngredientSearch } from "../../components/ingredient-search";
import { PantryPanel } from "../../components/pantry-panel";
import { pageTitle } from "../../lib/site";

export const metadata: Metadata = {
  title: pageTitle("Your pantry"),
  description:
    "One list of what you own, answering both the Bar and the Kitchen. Add ingredients and see what they unlock on either side.",
  alternates: { canonical: "/pantry" },
};

export default function PantryPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your pantry</h1>
        <p className="text-muted">
          One list of what you own. It answers both the{" "}
          <Link href="/bar" className="underline hover:text-foreground">
            Bar
          </Link>{" "}
          and the{" "}
          <Link href="/kitchen" className="underline hover:text-foreground">
            Kitchen
          </Link>{" "}
          — adding an ingredient here counts towards a drink and towards dinner.
        </p>
        <AuthMessage />
      </div>
      <IngredientSearch />
      <IngredientBrowse />
      <PantryPanel />
    </div>
  );
}