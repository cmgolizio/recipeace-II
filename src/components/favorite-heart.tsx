"use client";

import { useFavorites } from "../lib/favorites/store";

/**
 * Small heart shown next to a recipe name on recipe/match cards when the
 * signed-in user has favorited it. Renders nothing otherwise (including for
 * anonymous users), so it's safe to drop into server-rendered cards.
 */
export function FavoriteHeart({ recipeId }: { recipeId: number }) {
  const favorites = useFavorites();
  if (!favorites.includes(recipeId)) return null;
  return (
    <span
      title="In your favorites"
      aria-label="In your favorites"
      className="text-sm text-red-600 dark:text-red-400"
    >
      ♥
    </span>
  );
}