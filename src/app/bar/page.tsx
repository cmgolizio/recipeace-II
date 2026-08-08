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
  title: pageTitle("The Bar"),
  description:
    "Cocktails you can make from the ingredients you already have. Add what’s on your shelves and see what your pantry unlocks.",
  alternates: { canonical: "/bar" },
};

export default async function BarPage() {
  const supabase = await createClient();
  // Page size 1: this is the count, not the catalog.
  const { total } = await getRecipes(supabase, {
    domain: "cocktail",
    pageSize: 1,
  });

  return (
    <div className="space-y-8">
      <RememberDomain domain="cocktail" />
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">The Bar</h1>
        <p className="text-muted">
          {total > 0
            ? `${total} cocktail${total === 1 ? "" : "s"}, matched against the ingredients you already own.`
            : "Cocktails, matched against the ingredients you already own."}
        </p>
      </header>

      <IngredientSearch domain="cocktail" />
      <StarterSuggestions />
      <PantryPanel domain="cocktail" />
      <AlmostThereNudge domain="cocktail" />

      <p className="text-sm text-muted">
        <Link
          href={DOMAIN_ROUTES.cocktail.recipes}
          className="underline hover:text-foreground"
        >
          Browse the full catalog →
        </Link>
      </p>
    </div>
  );
}