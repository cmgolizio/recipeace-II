"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../components/empty-state";
import { RecipeCard } from "../../components/recipe-card";
import { RecipeCardSkeleton } from "../../components/skeleton";
import { useFavorites, useFavoritesReady } from "../../lib/favorites/store";
import { usePantryReady, useUser } from "../../lib/pantry/store";
import type { DomainFilter } from "../../lib/recipes/domain";
import {
  getRecipesByIds,
  type RecipePreview,
} from "../../lib/recipes/queries";
import { createClient } from "../../lib/supabase/client";

// Favorites span both domains: one table, filtered through the recipe join
// (docs/expansion-plan.md §8.10). The list is always fetched whole and split
// here — the filter is a view of one set of saved recipes, not two lists.
const TABS: { value: DomainFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cocktail", label: "Bar" },
  { value: "food", label: "Kitchen" },
];

// Keyed to the favorites it was computed for, so loading/error/results are
// derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; recipes: RecipePreview[] }
  | { key: string; error: string };

export default function FavoritesPage() {
  const user = useUser();
  const authReady = usePantryReady();
  const favorites = useFavorites();
  const favoritesReady = useFavoritesReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [domain, setDomain] = useState<DomainFilter>("all");

  const key = [...favorites].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (key === "") return;
    let ignore = false;
    const ids = key.split(",").map(Number);
    (async () => {
      const { recipes, error } = await getRecipesByIds(
        createClient(),
        ids,
        "all",
      );
      if (ignore) return;
      if (error) setOutcome({ key, error });
      else setOutcome({ key, recipes });
    })();
    return () => {
      ignore = true;
    };
  }, [key]);

  const heading = (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
      <p className="text-muted">Recipes you’ve saved to come back to.</p>
    </div>
  );

  const skeletonGrid = (
    <ul aria-hidden className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <RecipeCardSkeleton media />
        </li>
      ))}
    </ul>
  );

  // Wait for auth/favorites hydration before deciding what to show.
  if (!authReady || !favoritesReady) {
    return (
      <div className="space-y-6">
        {heading}
        {skeletonGrid}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="text-muted">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to save recipes to your favorites.
        </p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="space-y-6">
        {heading}
        <EmptyState
          icon="heart"
          title="No favorites yet"
          body="Tap “Save to favorites” on any recipe to keep it here."
          action={
            <Link href="/search" className={emptyStateActionClass}>
              Browse recipes
            </Link>
          }
        />
      </div>
    );
  }

  const current = outcome?.key === key ? outcome : null;
  const loading = current === null;
  const error = current && "error" in current ? current.error : null;
  const all = current && "recipes" in current ? current.recipes : [];
  const recipes =
    domain === "all" ? all : all.filter((r) => r.domain === domain);
  // Only offer the split once there is actually something to split.
  const domains = new Set(all.map((r) => r.domain));

  return (
    <div className="space-y-6">
      {heading}

      {domains.size > 1 && (
        <div
          role="group"
          aria-label="Filter favorites by domain"
          className="inline-flex rounded-lg border border-border p-0.5 text-sm"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={domain === tab.value}
              onClick={() => setDomain(tab.value)}
              className={
                domain === tab.value
                  ? "rounded-md bg-black/6 px-3 py-1 font-medium dark:bg-white/10"
                  : "rounded-md px-3 py-1 text-muted hover:text-foreground"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading && skeletonGrid}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load your favorites: {error}
        </p>
      )}

      {!loading && !error && recipes.length === 0 && (
        <p className="text-muted">
          Nothing saved from the {domain === "food" ? "Kitchen" : "Bar"} yet.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <RecipeCard recipe={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}