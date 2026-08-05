// src/lib/pantry/lens.ts
//
// Which side of the product an ingredient category *reads* as. Presentation
// only: the matcher never sees this, `ingredients.category` stays
// domain-agnostic in the schema, and a category serving both domains is
// listed under both. Judgment calls: `wine` (deglazing) and `garnish`
// (citrus twists vs. parsley) are deliberately dual.
//
// This is a static map rather than a count derived from
// recipe_ingredients ⋈ recipes.domain, on purpose — see restructure-plan.md
// D5. Revisit when the food catalog passes ~100 published recipes.

import type { Enums } from "../../types/database";
import type { RecipeDomain } from "../recipes/domain";

export type IngredientCategory = Enums<"ingredient_category">;

const CATEGORY_DOMAINS: Record<IngredientCategory, readonly RecipeDomain[]> = {
  // Bar
  spirit: ["cocktail"],
  liqueur: ["cocktail"],
  fortified_wine: ["cocktail"],
  bitters: ["cocktail"],
  mixer: ["cocktail"],
  // Kitchen
  meat: ["food"],
  seafood: ["food"],
  grain: ["food"],
  pasta: ["food"],
  bread: ["food"],
  legume: ["food"],
  canned_good: ["food"],
  oil_and_fat: ["food"],
  sauce: ["food"],
  condiment: ["food"],
  baking: ["food"],
  // Both
  wine: ["cocktail", "food"],
  juice: ["cocktail", "food"],
  syrup: ["cocktail", "food"],
  sweetener: ["cocktail", "food"],
  dairy: ["cocktail", "food"],
  egg: ["cocktail", "food"],
  produce: ["cocktail", "food"],
  herb: ["cocktail", "food"],
  spice: ["cocktail", "food"],
  garnish: ["cocktail", "food"],
  staple: ["cocktail", "food"],
  other: ["cocktail", "food"],
};

export function categoryDomains(
  category: IngredientCategory,
): readonly RecipeDomain[] {
  return CATEGORY_DOMAINS[category] ?? ["cocktail", "food"];
}

export function servesDomain(
  category: IngredientCategory,
  domain: RecipeDomain,
): boolean {
  return categoryDomains(category).includes(domain);
}

/** True when the category reads as belonging to both sides. */
export function isShared(category: IngredientCategory): boolean {
  return categoryDomains(category).length > 1;
}

/**
 * Split a set of categorized items into the current domain's shelf and the
 * other domain's. Shared items land on the current shelf — they are yours
 * here, and the "also in your pantry" group is for the genuinely other side.
 */
export function splitByLens<T extends { category: IngredientCategory }>(
  items: T[],
  domain: RecipeDomain,
): { mine: T[]; other: T[] } {
  const mine: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    (servesDomain(item.category, domain) ? mine : other).push(item);
  }
  return { mine, other };
}
