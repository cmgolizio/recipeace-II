import type { Metadata } from "next";
import Link from "next/link";

import { pageTitle } from "../../lib/site";
import { getRecipes } from "../../lib/recipes/queries";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: pageTitle("The Kitchen"),
  description:
    "Food recipes matched against the same pantry that powers the Bar. Browse the catalog or see what dinner your shelves already hold.",
  alternates: { canonical: "/kitchen" },
};

const cardClass =
  "block rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent";

export default async function KitchenPage() {
  const supabase = await createClient();
  // Page size 1: this is the count, not the catalog.
  const { total } = await getRecipes(supabase, { domain: "food", pageSize: 1 });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">The Kitchen</h1>
        <p className="text-muted">
          {total > 0
            ? `${total} recipe${total === 1 ? "" : "s"}, matched against the ingredients you already own.`
            : "Food recipes, matched against the ingredients you already own."}
        </p>
      </header>

      {total === 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Still being stocked</h2>
          <p className="mt-1 text-sm text-muted">
            There are no food recipes in the catalog yet. Nothing you add to
            your pantry is wasted in the meantime — it is one list, and it will
            count towards dinner as soon as the shelves are full.
          </p>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/kitchen/matches" className={cardClass}>
            <h2 className="font-semibold">What can I cook?</h2>
            <p className="mt-1 text-sm text-muted">
              Everything your pantry covers, and the dishes you’re an
              ingredient or two away from.
            </p>
          </Link>
          <Link href="/kitchen/recipes" className={cardClass}>
            <h2 className="font-semibold">Browse recipes</h2>
            <p className="mt-1 text-sm text-muted">
              The whole food catalog, filtered by course, cuisine, time and
              difficulty.
            </p>
          </Link>
        </div>
      )}

      <p className="text-sm text-muted">
        Your{" "}
        <Link href="/" className="underline hover:text-foreground">
          pantry
        </Link>{" "}
        is shared with the{" "}
        <Link href="/bar" className="underline hover:text-foreground">
          Bar
        </Link>{" "}
        — one list of what you own, both kinds of recipe.
      </p>
    </div>
  );
}
