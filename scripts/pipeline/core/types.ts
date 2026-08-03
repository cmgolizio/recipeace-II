// The shape every ingestion adapter produces, whatever it ingests
// (docs/expansion-plan.md §16). One lifecycle — load, normalize, validate,
// deduplicate, persist, report — over a domain-tagged result.
//
// Nothing here knows about prompts, files or providers. The cocktail adapter
// (domains/cocktail) fills the cocktail branch from an LLM; the food adapter
// (domains/food) fills the food branch from a curated source file.

import type { Enums } from "../../../src/types/database.ts";

export type RecipeDomain = Enums<"recipe_domain">;
export type Difficulty = Enums<"recipe_difficulty">;

/** Where a recipe came from and on what terms (§15). Recorded, never assumed. */
export type RecipeProvenance = {
  /** 'ai-generated', 'original', or the publication it was licensed from. */
  source: string;
  source_url: string | null;
  license: string | null;
};

export type ResolvedIngredient = {
  ingredient_id: number;
  amount: number | null;
  unit: string | null;
  preparation: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  display_order: number;
  raw_text: string | null;
  section: string | null;
};

/** Drink-only metadata — public.cocktail_recipe_details. */
export type ResolvedCocktailDetails = {
  method: string | null;
  glass: string | null;
  garnish: string | null;
  strength: number | null;
  base_spirit: string | null;
  flavor_tags: string[];
};

/** Food-only metadata — public.food_recipe_details. */
export type ResolvedFoodDetails = {
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  servings: number | null;
  course: string | null;
  cuisine: string | null;
};

type ResolvedRecipeShared = {
  slug: string;
  name: string;
  description: string | null;
  difficulty: Difficulty | null;
  instructions: string[];
  ingredients: ResolvedIngredient[];
  provenance: RecipeProvenance;
  /**
   * Reviewed content only. The food adapter defaults this to false — §34
   * requires food recipes to land unpublished and be published after review —
   * while the cocktail adapter keeps its existing behaviour of publishing.
   */
  is_published: boolean;
};

/**
 * A recipe carries its own domain's metadata and no other. Every adapter
 * states its domain explicitly; nothing infers it (§16.2, §16.3).
 */
export type ResolvedRecipe = ResolvedRecipeShared &
  (
    | { domain: "cocktail"; cocktail: ResolvedCocktailDetails }
    | { domain: "food"; food: ResolvedFoodDetails }
  );

/** Resolve an ingredient name (or alias) to its id, or null if unknown. */
export type Resolver = (name: string) => number | null;