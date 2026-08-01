import type { Metadata } from "next";
import Link from "next/link";

import { getRecipes } from "../../lib/recipes/queries";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: "The Bar — RecipeAce",
  description:
    "Cocktails you can make from the ingredients you already have. Browse the drinks catalog or see what your pantry unlocks.",
  alternates: { canonical: "/bar" },
};

const cardClass =
  "block rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent";

export default async function BarPage() {
  const supabase = await createClient();
  // Page size 1: this is the count, not the catalog.
  const { total } = await getRecipes(supabase, {
    domain: "cocktail",
    pageSize: 1,
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">The Bar</h1>
        <p className="text-muted">
          {total > 0
            ? `${total} cocktail${total === 1 ? "" : "s"}, matched against the ingredients you already own.`
            : "Cocktails, matched against the ingredients you already own."}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/bar/matches" className={cardClass}>
          <h2 className="font-semibold">What can I make?</h2>
          <p className="mt-1 text-sm text-muted">
            Every drink your pantry covers, and the ones you’re an ingredient
            or two away from.
          </p>
        </Link>
        <Link href="/bar/recipes" className={cardClass}>
          <h2 className="font-semibold">Browse cocktails</h2>
          <p className="mt-1 text-sm text-muted">
            The whole drinks catalog, filtered by method, glass, spirit and
            flavour.
          </p>
        </Link>
      </div>

      <p className="text-sm text-muted">
        Your{" "}
        <Link href="/" className="underline hover:text-foreground">
          pantry
        </Link>{" "}
        is shared with the{" "}
        <Link href="/kitchen" className="underline hover:text-foreground">
          Kitchen
        </Link>{" "}
        — one list of what you own, both kinds of recipe.
      </p>
    </div>
  );
}
