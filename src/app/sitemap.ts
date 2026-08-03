import type { MetadataRoute } from "next";

import { getPublishedRecipeSlugs } from "../lib/recipes/queries";
import { siteUrl } from "../lib/site-url";
import { createStaticClient } from "../lib/supabase/static";

// Re-generate hourly so recipes added by the offline pipeline show up
// without a redeploy, matching the detail pages' revalidation window.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public routes only — /favorites and /auth/* are user-specific. The
  // pre-expansion /recipes and /matches now redirect, so they are not listed.
  const staticRoutes: MetadataRoute.Sitemap = [
    "/",
    "/bar",
    "/bar/recipes",
    "/bar/matches",
    "/kitchen",
    "/kitchen/recipes",
    "/kitchen/matches",
    "/search",
    "/login",
  ].map((path) => ({ url: new URL(path, siteUrl).toString() }));

  const supabase = createStaticClient();
  if (!supabase) return staticRoutes;

  // Both domains: every published recipe has a public URL under /recipes.
  const [recipes, ingredientRows] = await Promise.all([
    getPublishedRecipeSlugs(supabase, "all"),
    supabase.from("ingredients").select("slug").order("slug"),
  ]);
  if (ingredientRows.error) {
    throw new Error(`Couldn’t build the sitemap: ${ingredientRows.error.message}`);
  }

  return [
    ...staticRoutes,
    ...recipes.map((recipe) => ({
      url: new URL(`/recipes/${recipe.slug}`, siteUrl).toString(),
      lastModified: new Date(recipe.updated_at),
    })),
    // Ingredient pages have no per-row timestamp — the taxonomy changes only
    // when the seed is re-run — so they go in without lastModified.
    ...(ingredientRows.data ?? []).map((ingredient) => ({
      url: new URL(`/ingredients/${ingredient.slug}`, siteUrl).toString(),
    })),
  ];
}