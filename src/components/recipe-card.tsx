import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FavoriteHeart } from "./favorite-heart";

/**
 * The card fields shared by every consumer. Description and image are
 * optional because the matches query doesn't select them.
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
 * The one canonical recipe card: a linked shell with image, name +
 * FavoriteHeart, method · glass line, and description. Surface-specific
 * body content (the matches page's ingredient chips) is passed as
 * children; `badge` renders on the right of the title row (the matches
 * status pill). `titleAs` lets the matches page keep h3 under its h2
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
  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="block h-full overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-black/30 dark:hover:border-white/40"
    >
      {recipe.image_url && (
        <div className="relative aspect-3/2 w-full">
          <Image
            src={recipe.image_url}
            alt=""
            fill
            sizes="(min-width: 640px) 360px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Title className="font-semibold">
            {recipe.name} <FavoriteHeart recipeId={recipe.id} />
          </Title>
          {badge}
        </div>
        {(recipe.method || recipe.glass) && (
          <p className="mt-0.5 text-xs uppercase tracking-wide opacity-50">
            {[recipe.method, recipe.glass].filter(Boolean).join(" · ")}
          </p>
        )}
        {recipe.description && (
          <p className="mt-2 text-sm text-muted">{recipe.description}</p>
        )}
        {children}
      </div>
    </Link>
  );
}