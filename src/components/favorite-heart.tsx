"use client";

import { toggleFavorite, useFavorites } from "../lib/favorites/store";
import { useUser } from "../lib/pantry/store";

import { toast } from "./toast/store";

/**
 * Small heart shown next to a recipe name on image-less cards when the
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

/**
 * Favorite toggle overlaid on the top-right of a card's image area.
 * Signed-in only — anonymous users get nothing here (the detail page carries
 * the log-in prompt). Sits inside the card Link, so it must not navigate.
 */
export function FavoriteHeartOverlay({ recipeId }: { recipeId: number }) {
  const user = useUser();
  const favorites = useFavorites();
  if (!user) return null;
  const favorited = favorites.includes(recipeId);
  const label = favorited ? "Remove from favorites" : "Save to favorites";
  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(recipeId);
        toast(favorited ? "Removed from favorites" : "Saved to favorites");
      }}
      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-sm backdrop-blur-sm hover:bg-black/60"
    >
      <span aria-hidden className={favorited ? "text-red-400" : "text-white"}>
        {favorited ? "♥" : "♡"}
      </span>
    </button>
  );
}