// The food adapter's input contract (docs/expansion-plan.md §16.3).
//
// Food content is curated, not generated (Decision 12), so the input is a
// declared catalog rather than a model response: the canonical ingredients the
// recipes need, the aliases that map real-world names onto them, and the
// recipes themselves. Everything is plain data, so a catalog can be reviewed
// in a diff before it is ever ingested.

import type { Category } from "../../../../src/data/cocktail-seed.ts";
import type { Difficulty } from "../../core/types.ts";

/** A canonical ingredient the catalog introduces to the shared taxonomy. */
export type FoodSourceIngredient = {
  name: string;
  category: Category;
  /** Another ingredient's name — the is-a edge the matcher walks. */
  parent?: string;
  /** Matching assumes the user owns this. Keep it rare (phase 3 policy). */
  isStaple?: boolean;
};

export type FoodSourceAlias = { alias: string; ingredient: string };

export type FoodSourceIngredientLine = {
  /** Canonical name or a known alias. Never "2 large eggs, separated". */
  name: string;
  amount?: number | null;
  unit?: string | null;
  /** "finely chopped", "divided", "to taste". */
  preparation?: string | null;
  optional?: boolean;
  /** "For the sauce". Omitted means the main list. */
  section?: string | null;
};

export type FoodSourceRecipe = {
  name: string;
  /** Defaults to the slugified name. */
  slug?: string;
  description?: string;
  course?: string;
  cuisine?: string;
  difficulty?: Difficulty;
  prepMinutes?: number;
  cookMinutes?: number;
  /** Defaults to prep + cook when both are given. */
  totalMinutes?: number;
  servings?: number;
  instructions: string[];
  ingredients: FoodSourceIngredientLine[];
  source: { name: string; url?: string; license: string };
  /**
   * Unreviewed content must not go live (§34, invariant 16). Omitted means
   * false — a recipe is published by an explicit editorial act.
   */
  publish?: boolean;
};

export type FoodCatalog = {
  ingredients?: FoodSourceIngredient[];
  aliases?: FoodSourceAlias[];
  recipes: FoodSourceRecipe[];
};

/**
 * Check that a parsed JSON blob is shaped like a catalog before any of the
 * recipe validators touch it, so a malformed file fails with a file-level
 * message instead of a hundred recipe-level ones.
 */
export function parseCatalog(value: unknown): FoodCatalog {
  if (typeof value !== "object" || value === null) {
    throw new Error("catalog must be a JSON object");
  }
  const catalog = value as Record<string, unknown>;
  if (!Array.isArray(catalog.recipes)) {
    throw new Error("catalog.recipes must be an array");
  }
  for (const key of ["ingredients", "aliases"] as const) {
    if (catalog[key] !== undefined && !Array.isArray(catalog[key])) {
      throw new Error(`catalog.${key} must be an array when present`);
    }
  }
  return catalog as unknown as FoodCatalog;
}
