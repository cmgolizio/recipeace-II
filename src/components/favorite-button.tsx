"use client";

import Link from "next/link";

import {
  toggleFavorite,
  useFavorites,
  useFavoritesReady,
} from "../lib/favorites/store";
import { usePantryReady, useUser } from "../lib/pantry/store";

/**
 * Heart toggle for the recipe detail page. Signed-in users can favorite the
 * recipe; anonymous users get a log-in prompt instead. Renders nothing until
 * auth resolves so the wrong variant never flashes.
 */
export function FavoriteButton({ recipeId }: { recipeId: number }) {
  const user = useUser();
  const authReady = usePantryReady();
  const favorites = useFavorites();
  const favoritesReady = useFavoritesReady();

  if (!authReady || !favoritesReady) return null;

  if (!user) {
    return (
      <p className="text-sm opacity-60">
        <Link href="/login" className="underline">
          Log in
        </Link>{" "}
        to save this recipe to your favorites.
      </p>
    );
  }

  const favorited = favorites.includes(recipeId);
  return (
    <button
      type="button"
      aria-pressed={favorited}
      onClick={() => toggleFavorite(recipeId)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/4 dark:border-white/20 dark:hover:bg-white/6"
    >
      <span
        aria-hidden
        className={favorited ? "text-red-600 dark:text-red-400" : "opacity-50"}
      >
        {favorited ? "♥" : "♡"}
      </span>
      {favorited ? "Saved to favorites" : "Save to favorites"}
    </button>
  );
}