// Recipe domain — the one place application code talks about "cocktail" vs
// "food" (docs/expansion-plan.md §5.1, Decision 6).
//
// The domain lives on recipes.domain in the database; everything else derives
// it by joining. Here it is only ever a *filter*: which slice of the catalog a
// surface is asking for.

import type { Enums } from "../../types/database";

export type RecipeDomain = Enums<"recipe_domain">;

export const RECIPE_DOMAINS = ["cocktail", "food"] as const;

/**
 * What a query asks for: one domain, or the whole catalog. "all" is spelled
 * out rather than left as undefined so every call site states its intent.
 */
export type DomainFilter = RecipeDomain | "all";

export function isRecipeDomain(value: unknown): value is RecipeDomain {
  return RECIPE_DOMAINS.some((d) => d === value);
}

/** Parse an untrusted value (a search param, a route segment) into a filter. */
export function parseDomainFilter(value: unknown): DomainFilter {
  return isRecipeDomain(value) ? value : "all";
}

/** Surface names for each domain — the Bar/Kitchen product split. */
export const DOMAIN_SURFACE: Record<RecipeDomain, string> = {
  cocktail: "Bar",
  food: "Kitchen",
};

/** Singular noun for one recipe of this domain. */
export const DOMAIN_NOUN: Record<RecipeDomain, string> = {
  cocktail: "cocktail",
  food: "recipe",
};
