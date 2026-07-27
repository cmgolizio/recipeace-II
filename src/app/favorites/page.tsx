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
import { createClient } from "../../lib/supabase/client";
import type { Tables } from "../../types/database";

type Recipe = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "method"
  | "glass"
  | "image_url"
  | "strength"
  | "difficulty"
  | "flavor_tags"
>;

// Keyed to the favorites it was computed for, so loading/error/results are
// derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; recipes: Recipe[] }
  | { key: string; error: string };

export default function FavoritesPage() {
  const user = useUser();
  const authReady = usePantryReady();
  const favorites = useFavorites();
  const favoritesReady = useFavoritesReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = [...favorites].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (key === "") return;
    let ignore = false;
    const ids = key.split(",").map(Number);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id,slug,name,description,method,glass,image_url,strength,difficulty,flavor_tags",
        )
        .in("id", ids)
        .order("name");
      if (ignore) return;
      if (error) setOutcome({ key, error: error.message });
      else setOutcome({ key, recipes: data ?? [] });
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
            <Link href="/recipes" className={emptyStateActionClass}>
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
  const recipes = current && "recipes" in current ? current.recipes : [];

  return (
    <div className="space-y-6">
      {heading}

      {loading && skeletonGrid}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load your favorites: {error}
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