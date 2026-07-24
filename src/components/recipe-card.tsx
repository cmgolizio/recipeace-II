import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FavoriteHeart, FavoriteHeartOverlay } from "./favorite-heart";

/**
 * The card fields shared by every consumer. Description and image are
 * optional because the matches query doesn't select them: `undefined` means
 * "this surface doesn't do images" (no media block at all), while `null`
 * means "fetched, but the recipe has none" (branded fallback tile).
 */
export type RecipeCardRecipe = {
  id: number;
  slug: string;
  name: string;
  method: string | null;
  glass: string | null;
  description?: string | null;
  image_url?: string | null;
};

/**
 * The one canonical recipe card: a linked shell with image (photo or branded
 * fallback), favorite heart, name, method/glass pills, and description.
 * Surface-specific body content (the matches page's ingredient chips) is
 * passed as children; `badge` renders on the right of the title row (the
 * matches status pill). `titleAs` lets the matches page keep h3 under its h2
 * section headers.
 */
export function RecipeCard({
  recipe,
  badge,
  titleAs: Title = "h2",
  children,
}: {
  recipe: RecipeCardRecipe;
  badge?: ReactNode;
  titleAs?: "h2" | "h3";
  children?: ReactNode;
}) {
  const hasMedia = recipe.image_url !== undefined;
  const pills = [recipe.method, recipe.glass].filter((v): v is string => !!v);
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="block h-full overflow-hidden rounded-xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-accent"
    >
      {hasMedia && (
        <div className="relative aspect-3/2 w-full">
          {recipe.image_url ? (
            <>
              <Image
                src={recipe.image_url}
                alt=""
                fill
                sizes="(min-width: 640px) 360px, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/35 to-transparent"
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent/10">
              <span
                aria-hidden
                className="text-4xl font-semibold text-accent/70"
              >
                {recipe.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <FavoriteHeartOverlay recipeId={recipe.id} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Title className="font-semibold">
            {recipe.name}
            {!hasMedia && (
              <>
                {" "}
                <FavoriteHeart recipeId={recipe.id} />
              </>
            )}
          </Title>
          {badge}
        </div>
        {pills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
        {recipe.description && (
          <p className="mt-2 text-sm text-muted">{recipe.description}</p>
        )}
        {children}
      </div>
    </Link>
  );
}
