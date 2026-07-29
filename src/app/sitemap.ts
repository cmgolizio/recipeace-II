import type { MetadataRoute } from "next";

import { siteUrl } from "../lib/site-url";
import { createStaticClient } from "../lib/supabase/static";

// Re-generate hourly so recipes added by the offline pipeline show up
// without a redeploy, matching the detail pages' revalidation window.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public routes only — /favorites and /auth/* are user-specific.
  const staticRoutes: MetadataRoute.Sitemap = [
    "/",
    "/recipes",
    "/matches",
    "/login",
  ].map((path) => ({ url: new URL(path, siteUrl).toString() }));

  const supabase = createStaticClient();
  if (!supabase) return staticRoutes;

  const [recipeRows, ingredientRows] = await Promise.all([
    supabase
      .from("recipes")
      .select("slug,updated_at")
      .eq("is_published", true)
      .order("slug"),
    supabase.from("ingredients").select("slug").order("slug"),
  ]);
  const failure = recipeRows.error ?? ingredientRows.error;
  if (failure) {
    throw new Error(`Couldn’t build the sitemap: ${failure.message}`);
  }

  return [
    ...staticRoutes,
    ...(recipeRows.data ?? []).map((recipe) => ({
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