// Supabase admin access for the pipeline. Uses the SERVICE/SECRET key, which
// bypasses RLS — this is the offline ingest path, never the request path.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../src/types/database.ts";
import type { RecipeMetadata, ResolvedRecipe, Resolver } from "./domains/cocktail/validate.ts";
import type { VocabularyEntry } from "./domains/cocktail/generate.ts";

export type Admin = SupabaseClient<Database>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function createAdminClient(): Admin {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadTaxonomy(
  admin: Admin,
): Promise<{ resolve: Resolver; vocabulary: VocabularyEntry[] }> {
  const { data: ingredients, error: ingErr } = await admin
    .from("ingredients")
    .select("id,name,category");
  if (ingErr) throw new Error(`loading ingredients failed: ${ingErr.message}`);

  const { data: aliases, error: aliasErr } = await admin
    .from("ingredient_aliases")
    .select("alias,ingredient_id");
  if (aliasErr) throw new Error(`loading aliases failed: ${aliasErr.message}`);

  const map = new Map<string, number>();
  for (const a of aliases ?? []) map.set(normalize(a.alias), a.ingredient_id);
  // Canonical names win over any alias collision.
  for (const i of ingredients ?? []) map.set(normalize(i.name), i.id);

  return {
    resolve: (name) => map.get(normalize(name)) ?? null,
    vocabulary: (ingredients ?? []).map((i) => ({ name: i.name, category: i.category })),
  };
}

export async function loadExistingRecipes(
  admin: Admin,
): Promise<{ slugs: Set<string>; names: string[] }> {
  const { data, error } = await admin.from("recipes").select("slug,name");
  if (error) throw new Error(`loading recipes failed: ${error.message}`);
  return {
    slugs: new Set((data ?? []).map((r) => r.slug)),
    names: (data ?? []).map((r) => r.name),
  };
}

export async function ingestRecipe(admin: Admin, recipe: ResolvedRecipe): Promise<void> {
  if (recipe.domain !== "cocktail") {
    // The food adapter emits idempotent SQL rather than writing through the
    // admin client (see scripts/pipeline/domains/food/README of intent in
    // ingest-food.ts); this path is the drinks one.
    throw new Error(`ingestRecipe only handles cocktails, got "${recipe.domain}"`);
  }
  // Shared fields only — drink metadata goes to cocktail_recipe_details below
  // (phase 5). The deprecated columns on `recipes` are no longer written.
  const { data, error } = await admin
    .from("recipes")
    .upsert(
      {
        slug: recipe.slug,
        name: recipe.name,
        description: recipe.description,
        domain: recipe.domain,
        instructions: recipe.instructions,
        source: recipe.provenance.source,
        source_url: recipe.provenance.source_url,
        license: recipe.provenance.license,
        is_published: recipe.is_published,
        difficulty: recipe.difficulty,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`upsert recipe "${recipe.slug}" failed: ${error?.message ?? "no row returned"}`);
  }

  const recipeId = data.id;
  const details = await admin
    .from("cocktail_recipe_details")
    .upsert({ recipe_id: recipeId, ...recipe.cocktail }, { onConflict: "recipe_id" });
  if (details.error) {
    throw new Error(
      `upsert cocktail details for "${recipe.slug}" failed: ${details.error.message}`,
    );
  }

  // Replace the ingredient set so re-ingesting a recipe stays clean.
  const del = await admin.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  if (del.error) {
    throw new Error(`clearing ingredients for "${recipe.slug}" failed: ${del.error.message}`);
  }

  const rows = recipe.ingredients.map((i) => ({ recipe_id: recipeId, ...i }));
  const ins = await admin.from("recipe_ingredients").insert(rows);
  if (ins.error) {
    throw new Error(`inserting ingredients for "${recipe.slug}" failed: ${ins.error.message}`);
  }
}

// ── Images (phase 9) ────────────────────────────────────────────────────────
const IMAGE_BUCKET = "recipe-images";

export type RecipeForImage = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  method: string | null;
  glass: string | null;
  garnish: string | null;
};

/** Create the public image bucket if it does not already exist. */
export async function ensureImageBucket(admin: Admin): Promise<void> {
  const { data } = await admin.storage.getBucket(IMAGE_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(IMAGE_BUCKET, { public: true });
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`creating bucket "${IMAGE_BUCKET}" failed: ${error.message}`);
  }
}

export async function loadRecipesMissingImages(admin: Admin): Promise<RecipeForImage[]> {
  // The prompt describes a drink, so this reads the cocktail catalog view.
  const { data, error } = await admin
    .from("cocktail_recipes")
    .select("id,slug,name,description,method,glass,garnish")
    .is("image_url", null);
  if (error) throw new Error(`loading recipes failed: ${error.message}`);
  return data ?? [];
}

/** Upload image bytes (upsert) and return the public URL. */
export async function uploadRecipeImage(
  admin: Admin,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`uploading "${path}" failed: ${error.message}`);
  return admin.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function setRecipeImageUrl(
  admin: Admin,
  id: number,
  imageUrl: string,
): Promise<void> {
  const { error } = await admin.from("recipes").update({ image_url: imageUrl }).eq("id", id);
  if (error) throw new Error(`updating image_url for recipe ${id} failed: ${error.message}`);
}

// ── Metadata enrichment (polish-plan2 phase 5) ──────────────────────────────
export type RecipeForEnrich = {
  id: number;
  name: string;
  /** Human-readable ingredient lines ("2 oz gin"), for the LLM prompt. */
  ingredients: string[];
};

/**
 * Published recipes that still need metadata. A null difficulty marks an
 * unenriched row — the enrich step always writes difficulty (possibly null on
 * a bad model answer, in which case the recipe is simply retried next run).
 */
export async function loadRecipesMissingMetadata(admin: Admin): Promise<RecipeForEnrich[]> {
  // Cocktails only: the enrichment prompt is a bartender's, and its output
  // lands in cocktail_recipe_details.
  const { data, error } = await admin
    .from("recipes")
    .select("id,name,recipe_ingredients(amount,unit,ingredients(name))")
    .eq("is_published", true)
    .eq("domain", "cocktail")
    .is("difficulty", null);
  if (error) throw new Error(`loading recipes failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ingredients: r.recipe_ingredients.map((ri) =>
      [ri.amount ?? "", ri.unit ?? "", ri.ingredients?.name ?? ""]
        .filter((x) => x !== "")
        .join(" "),
    ),
  }));
}

/**
 * Enrichment writes land in two places from phase 5 on: difficulty applies to
 * any recipe and stays on `recipes`; strength, flavor tags and base spirit are
 * drink-only and belong to cocktail_recipe_details.
 */
export async function updateRecipeMetadata(
  admin: Admin,
  id: number,
  meta: RecipeMetadata,
): Promise<void> {
  const shared = await admin
    .from("recipes")
    .update({ difficulty: meta.difficulty })
    .eq("id", id);
  if (shared.error) {
    throw new Error(`updating metadata for recipe ${id} failed: ${shared.error.message}`);
  }
  const details = await admin.from("cocktail_recipe_details").upsert(
    {
      recipe_id: id,
      strength: meta.strength,
      flavor_tags: meta.flavor_tags,
      base_spirit: meta.base_spirit,
    },
    { onConflict: "recipe_id" },
  );
  if (details.error) {
    throw new Error(
      `updating drink metadata for recipe ${id} failed: ${details.error.message}`,
    );
  }
}