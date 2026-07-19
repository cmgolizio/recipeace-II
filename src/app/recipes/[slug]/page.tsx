import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  RecipePantryStatus,
  type IngredientRow,
} from "../../../components/recipe-pantry-status";
import { createClient } from "../../../lib/supabase/server";
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
>;

type Props = { params: Promise<{ slug: string }> };

// Deduped across generateMetadata and the page render.
const getRecipe = cache(async (slug: string): Promise<RecipeHeader | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id,slug,name,description,method,glass,garnish,instructions,image_url",
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
  const title = `${recipe.name} — Recipeace`;
  const description = recipe.description ?? undefined;
  const images = recipe.image_url ? [recipe.image_url] : undefined;
  return {
    title,
    description,
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

  const supabase = await createClient();
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
      <Link
        href="/recipes"
        className="text-sm underline opacity-60 hover:opacity-100"
      >
        ← All recipes
      </Link>

      {recipe.image_url && (
        <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
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
        {recipe.description && (
          <p className="pt-1 opacity-70">{recipe.description}</p>
        )}
      </header>

      <RecipePantryStatus recipeId={recipe.id} ingredients={ingredients} />

      {recipe.instructions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Garnish
          </h2>
          <p className="mt-1 opacity-90">{recipe.garnish}</p>
        </section>
      )}
    </article>
  );
}