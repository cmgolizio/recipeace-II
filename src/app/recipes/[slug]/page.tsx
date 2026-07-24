import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  RecipePantryStatus,
  type IngredientRow,
} from "../../../components/recipe-pantry-status";
import { ShareButton } from "../../../components/share-button";
import { siteUrl } from "../../../lib/site-url";
import { createStaticClient } from "../../../lib/supabase/static";
import type { Tables } from "../../../types/database";

type RecipeHeader = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "method"
  | "glass"
  | "garnish"
  | "instructions"
  | "image_url"
  | "strength"
  | "difficulty"
  | "flavor_tags"
>;

type Props = { params: Promise<{ slug: string }> };

// Rendered statically at build time and revalidated hourly, so recipes
// updated by the offline pipeline surface without a redeploy. Live pantry
// status stays in the RecipePantryStatus client island.
export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createStaticClient();
  // Env-less build (e.g. CI): skip prerendering; slugs render on demand.
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("slug")
    .eq("is_published", true);
  if (error) throw new Error(`Couldn’t list recipe slugs: ${error.message}`);
  return (data ?? []).map(({ slug }) => ({ slug }));
}

// Deduped across generateMetadata and the page render. Uses the cookie-free
// client — recipe data is world-readable, and touching cookies() here would
// make the route dynamic.
const getRecipe = cache(async (slug: string): Promise<RecipeHeader | null> => {
  const supabase = createStaticClient();
  if (!supabase) throw new Error("Supabase environment is not configured");
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id,slug,name,description,method,glass,garnish,instructions,image_url,strength,difficulty,flavor_tags",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t load this recipe: ${error.message}`);
  return data;
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
  const { data: rows, error } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id,amount,unit,preparation,is_optional,display_order,ingredients(name)")
    .eq("recipe_id", recipe.id);
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
      display_order: r.display_order,
      name: r.ingredients?.name ?? "—",
    }))
    .sort(
      (a, b) =>
        a.display_order - b.display_order || a.name.localeCompare(b.name),
    );

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/recipes"
          className="text-sm text-muted underline hover:text-foreground"
        >
          ← All recipes
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
        {(recipe.method || recipe.glass) && (
          <p className="text-xs uppercase tracking-wide opacity-50">
            {[recipe.method, recipe.glass].filter(Boolean).join(" · ")}
          </p>
        )}
        {(recipe.difficulty ||
          recipe.strength != null ||
          recipe.flavor_tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {[
              recipe.difficulty,
              recipe.strength != null ? `~${recipe.strength}% ABV` : null,
              ...recipe.flavor_tags,
            ]
              .filter((v): v is string => !!v)
              .map((pill) => (
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

      {recipe.garnish && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Garnish
          </h2>
          <p className="mt-1 opacity-90">{recipe.garnish}</p>
        </section>
      )}
    </article>
  );
}