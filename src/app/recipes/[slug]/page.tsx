import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { RecipeCard } from "../../../components/recipe-card";
import {
  RecipePantryStatus,
  type IngredientRow,
} from "../../../components/recipe-pantry-status";
import { ShareButton } from "../../../components/share-button";
import {
  DOMAIN_ROUTES,
  DOMAIN_SURFACE,
} from "../../../lib/recipes/domain";
import {
  formatMinutes,
  getPublishedRecipeSlugs,
  getRecipeBySlug,
} from "../../../lib/recipes/queries";
import { siteUrl } from "../../../lib/site-url";
import { createStaticClient } from "../../../lib/supabase/static";

type Props = { params: Promise<{ slug: string }> };

/** "2 oz white rum, muddled" — the line schema.org's recipeIngredient wants. */
function ingredientLine(ri: IngredientRow): string {
  const line = [ri.amount != null ? String(ri.amount) : null, ri.unit, ri.name]
    .filter((part): part is string => !!part)
    .join(" ");
  return ri.preparation ? `${line}, ${ri.preparation}` : line;
}

// Rendered statically at build time and revalidated hourly, so recipes
// updated by the offline pipeline surface without a redeploy. Live pantry
// status stays in the RecipePantryStatus client island.
export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createStaticClient();
  // Env-less build (e.g. CI): skip prerendering; slugs render on demand.
  if (!supabase) return [];
  // Every domain: this one route serves the whole catalog (plan §9.4).
  const slugs = await getPublishedRecipeSlugs(supabase, "all");
  return slugs.map(({ slug }) => ({ slug }));
}

// Deduped across generateMetadata and the page render. Uses the cookie-free
// client — recipe data is world-readable, and touching cookies() here would
// make the route dynamic.
const getRecipe = cache(async (slug: string) => {
  const supabase = createStaticClient();
  if (!supabase) throw new Error("Supabase environment is not configured");
  return getRecipeBySlug(supabase, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) return {};
  const title = `${recipe.name} — In House Mixers`;
  const description = recipe.description ?? undefined;
  const images = recipe.image_url ? [recipe.image_url] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/recipes/${slug}` },
    openGraph: { title, description, images },
    twitter: {
      card: recipe.image_url ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

export default async function RecipeDetailPage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipe(slug);
  if (!recipe) notFound();

  const supabase = createStaticClient();
  if (!supabase) throw new Error("Supabase environment is not configured");
  const [{ data: rows, error }, { data: relatedRows }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select(
        "ingredient_id,amount,unit,preparation,is_optional,is_garnish,display_order,ingredients(name,slug)",
      )
      .eq("recipe_id", recipe.id),
    // "More like this" is supplementary: an error here leaves the row out
    // rather than failing the whole page.
    supabase.rpc("related_recipes", {
      p_recipe_id: recipe.id,
      max_results: 4,
    }),
  ]);
  if (error) {
    throw new Error(`Couldn’t load this recipe: ${error.message}`);
  }

  // Same ordering as the recipe_pantry_status RPC: display_order, then name.
  const ingredients: IngredientRow[] = (rows ?? [])
    .map((r) => ({
      ingredient_id: r.ingredient_id,
      amount: r.amount,
      unit: r.unit,
      preparation: r.preparation,
      is_optional: r.is_optional,
      is_garnish: r.is_garnish,
      display_order: r.display_order,
      name: r.ingredients?.name ?? "—",
      slug: r.ingredients?.slug ?? null,
    }))
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name),
    );
  const related = relatedRows ?? [];

  // Its own domain's metadata, and only that. The union in getRecipeBySlug
  // means a food recipe has no `cocktail` member to read by accident.
  const cocktail = recipe.domain === "cocktail" ? recipe.cocktail : null;
  const food = recipe.domain === "food" ? recipe.food : null;
  const subtitle = (
    cocktail ? [cocktail.method, cocktail.glass] : [food?.course, food?.cuisine]
  ).filter((v): v is string => !!v);
  const pills = (
    cocktail
      ? [
          recipe.difficulty,
          cocktail.strength != null ? `~${cocktail.strength}% ABV` : null,
          ...cocktail.flavor_tags,
        ]
      : [
          recipe.difficulty,
          food?.total_minutes != null ? formatMinutes(food.total_minutes) : null,
          food?.servings != null ? `serves ${food.servings}` : null,
        ]
  ).filter((v): v is string => !!v);

  // Structured data for search engines. Built from the server-rendered rows,
  // so it always matches the page as delivered — not the client pantry
  // overlay, and not the reader's oz/ml or serving-scale preferences.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.name,
    ...(recipe.description ? { description: recipe.description } : {}),
    ...(recipe.image_url ? { image: recipe.image_url } : {}),
    recipeIngredient: ingredients.map(ingredientLine),
    ...(recipe.instructions.length > 0
      ? { recipeInstructions: recipe.instructions }
      : {}),
    ...(cocktail
      ? { recipeYield: "1 cocktail" }
      : food?.servings != null
        ? { recipeYield: `${food.servings} servings` }
        : {}),
  };

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between">
        {/* Back to the catalog this recipe belongs to — the detail route is
            shared, the browsing surfaces are not. */}
        <Link
          href={DOMAIN_ROUTES[recipe.domain].recipes}
          className="text-sm text-muted underline hover:text-foreground"
        >
          ← All {DOMAIN_SURFACE[recipe.domain].toLowerCase()} recipes
        </Link>
        <ShareButton
          title={recipe.name}
          url={new URL(`/recipes/${recipe.slug}`, siteUrl).toString()}
        />
      </div>

      {recipe.image_url && (
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-border">
          <Image
            src={recipe.image_url}
            alt={recipe.name}
            fill
            preload
            sizes="320px"
            className="object-cover"
          />
        </div>
      )}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
        {subtitle.length > 0 && (
          <p className="text-xs uppercase tracking-wide opacity-50">
            {subtitle.join(" · ")}
          </p>
        )}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
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
          <p className="pt-1 text-muted">{recipe.description}</p>
        )}
      </header>

      <RecipePantryStatus recipeId={recipe.id} ingredients={ingredients} />

      {/* The island renders the garnish ingredients when the recipe has any;
          this free-text note is the fallback for recipes that don't. */}
      {cocktail?.garnish && !ingredients.some((ri) => ri.is_garnish) && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Garnish
          </h2>
          <p className="mt-1 opacity-90">{cocktail.garnish}</p>
        </section>
      )}

      {recipe.instructions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Method
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {recipe.instructions.map((step, idx) => (
              <li key={idx} className="opacity-90">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.source && (
        <p className="text-sm text-muted">Source: {recipe.source}</p>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            More like this
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.recipe_id}>
                <RecipeCard
                  recipe={{
                    id: r.recipe_id,
                    slug: r.slug,
                    name: r.name,
                    pills: [r.method, r.glass].filter(
                      (v): v is string => !!v,
                    ),
                    image_url: r.image_url,
                  }}
                  titleAs="h3"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Last child on purpose: the article's space-y-6 would otherwise put a
          gap above the first visible element. A display:none script absorbs
          that margin harmlessly here. */}
      <script
        type="application/ld+json"
        // JSON.stringify doesn't escape markup; neutralise "<" so a stray
        // tag in recipe text can't break out of the script element.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </article>
  );
}