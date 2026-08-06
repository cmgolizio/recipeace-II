import type { Metadata } from "next";
import Link from "next/link";

import { AlmostThereNudge } from "../../components/almost-there-nudge";
import { IngredientSearch } from "../../components/ingredient-search";
import { RememberDomain } from "../../components/last-domain";
import { PantryPanel } from "../../components/pantry-panel";
import { StarterSuggestions } from "../../components/starter-suggestions";
import { pageTitle } from "../../lib/site";
import { DOMAIN_ROUTES } from "../../lib/recipes/domain";
import { getRecipes } from "../../lib/recipes/queries";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: pageTitle("The Kitchen"),
  description:
    "Food recipes matched against the same pantry that powers the Bar. Add what’s on your shelves and see what dinner they already hold.",
  alternates: { canonical: "/kitchen" },
};

export default async function KitchenPage() {
  const supabase = await createClient();
  // Page size 1: this is the count, not the catalog.
  const { total } = await getRecipes(supabase, { domain: "food", pageSize: 1 });

  return (
    <div className="space-y-8">
      <RememberDomain domain="food" />
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">The Kitchen</h1>
        <p className="text-muted">
          {total > 0
            ? `${total} recipe${total === 1 ? "" : "s"}, matched against the ingredients you already own.`
            : "Food recipes, matched against the ingredients you already own."}
        </p>
      </header>

      {total === 0 && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold">Still being stocked</h2>
          <p className="mt-1 text-sm text-muted">
            There are no food recipes in the catalog yet. Nothing you add to
            your pantry is wasted in the meantime — it is one list, and it will
            count towards dinner as soon as the shelves are full.
          </p>
        </section>
      )}

      <IngredientSearch domain="food" />
      <StarterSuggestions />
      <PantryPanel domain="food" />
      <AlmostThereNudge domain="food" />

      <p className="text-sm text-muted">
        <Link
          href={DOMAIN_ROUTES.food.recipes}
          className="underline hover:text-foreground"
        >
          Browse the full catalog →
        </Link>
      </p>
    </div>
  );
}
