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
  food: "dish",
};

/**
 * The route convention: each domain owns a subtree, and everything shared —
 * the pantry at `/`, recipe details at `/recipes/[slug]`, favorites, the
 * shopping list — sits outside them (docs/expansion-plan.md §9).
 */
export const DOMAIN_ROUTES: Record<
  RecipeDomain,
  { home: string; recipes: string; matches: string }
> = {
  cocktail: { home: "/bar", recipes: "/bar/recipes", matches: "/bar/matches" },
  food: {
    home: "/kitchen",
    recipes: "/kitchen/recipes",
    matches: "/kitchen/matches",
  },
};

/**
 * Card pills from a match's domain-shaped `metadata` object
 * (match_recipes_detail builds it; ingredient_detail uses the same shape).
 * Each domain contributes what it has and nothing else — the object never
 * carries the other domain's keys, and nulls are stripped before it arrives.
 */
export function matchPills(domain: RecipeDomain, metadata: unknown): string[] {
  const fields = (metadata ?? {}) as Record<string, string | number>;
  const keys =
    domain === "cocktail" ? ["method", "glass"] : ["course", "total_minutes"];
  return keys
    .map((key) => fields[key])
    .filter((value): value is string | number => value != null)
    .map((value) =>
      typeof value === "number" ? formatMinutes(value) : value,
    );
}

/** What the user's own stock is called on each side. */
export const DOMAIN_SHELF: Record<RecipeDomain, string> = {
  cocktail: "Your bar",
  food: "Your kitchen",
};

/** The matches CTA, per domain. */
export const DOMAIN_MATCH_CTA: Record<RecipeDomain, string> = {
  cocktail: "See what I can make →",
  food: "See what I can cook →",
};

/** The other side. Two domains, so this is total. */
export function otherDomain(domain: RecipeDomain): RecipeDomain {
  return domain === "cocktail" ? "food" : "cocktail";
}

/** "45 min", "1 hr 15 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}