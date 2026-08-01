// Recipe data access. One implementation per question the product asks,
// each taking an explicit domain (docs/expansion-plan.md §10).
//
// Domain filtering happens here — in the database query — never in the
// browser after the fact. Callers pass "all" when they genuinely want the
// whole catalog; there is no implicit default, so a surface that forgets to
// think about domain doesn't compile.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums, Tables } from "../../types/database";
import type { DomainFilter } from "./domain";

export type RecipeClient = SupabaseClient<Database>;

/** Columns every recipe card renders. Kept in one place so the card's data
 *  requirements can't drift apart between surfaces. */
const CARD_COLUMNS =
  "id,slug,name,description,domain,method,glass,image_url,strength,difficulty,flavor_tags";

/** The shared preview shape backing every recipe card (plan §10.3). */
export type RecipePreview = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "domain"
  | "method"
  | "glass"
  | "image_url"
  | "strength"
  | "difficulty"
  | "flavor_tags"
>;

export type RecipeSort = "name" | "newest" | "strength";

export type RecipeListFilters = {
  q: string;
  /** Cocktail facets; empty string means "not filtered". Food facets arrive
   *  with the Kitchen catalog in phase 10. */
  method: string;
  glass: string;
  difficulty: "" | Enums<"recipe_difficulty">;
  spirit: string;
  tags: string[];
  sort: RecipeSort;
};

export const EMPTY_FILTERS: RecipeListFilters = {
  q: "",
  method: "",
  glass: "",
  difficulty: "",
  spirit: "",
  tags: [],
  sort: "name",
};

export type RecipeListResult = {
  recipes: RecipePreview[];
  /** Total matching rows, for pagination. */
  total: number;
  error: string | null;
};

/**
 * PostgREST's or= list treats , ( ) specially, so the pattern is double-quoted
 * and the quote/backslash characters inside it are escaped.
 */
function ilikePattern(q: string): string {
  return `%${q.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}%`;
}

/** Narrow a published-recipe query to one domain. "all" adds no predicate. */
function scopeToDomain<T extends { eq(column: "domain", value: string): T }>(
  query: T,
  domain: DomainFilter,
): T {
  return domain === "all" ? query : query.eq("domain", domain);
}

/** One page of the published catalog, filtered and sorted. */
export async function getRecipes(
  client: RecipeClient,
  {
    domain,
    filters = EMPTY_FILTERS,
    page = 1,
    pageSize = 24,
  }: {
    domain: DomainFilter;
    filters?: RecipeListFilters;
    page?: number;
    pageSize?: number;
  },
): Promise<RecipeListResult> {
  const from = (page - 1) * pageSize;
  let query = scopeToDomain(
    client
      .from("recipes")
      .select(CARD_COLUMNS, { count: "exact" })
      .eq("is_published", true),
    domain,
  ).range(from, from + pageSize - 1);

  query =
    filters.sort === "newest"
      ? query.order("created_at", { ascending: false }).order("name")
      : filters.sort === "strength"
        ? query
            .order("strength", { ascending: false, nullsFirst: false })
            .order("name")
        : query.order("name");

  if (filters.method) query = query.eq("method", filters.method);
  if (filters.glass) query = query.eq("glass", filters.glass);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.spirit) query = query.eq("base_spirit", filters.spirit);
  if (filters.tags.length > 0)
    query = query.contains("flavor_tags", filters.tags);
  if (filters.q) {
    const pattern = ilikePattern(filters.q);
    query = query.or(`name.ilike."${pattern}",description.ilike."${pattern}"`);
  }

  const { data, count, error } = await query;
  return {
    recipes: data ?? [],
    total: count ?? 0,
    error: error?.message ?? null,
  };
}

export type RecipeFacetRow = Pick<
  Tables<"recipes">,
  "method" | "glass" | "difficulty" | "base_spirit" | "flavor_tags"
>;

/**
 * Facet values for the filter controls, taken from the whole domain rather
 * than the current page so switching a value never dead-ends the controls.
 */
export async function getRecipeFacets(
  client: RecipeClient,
  domain: DomainFilter,
): Promise<RecipeFacetRow[]> {
  const { data } = await scopeToDomain(
    client
      .from("recipes")
      .select("method,glass,difficulty,base_spirit,flavor_tags")
      .eq("is_published", true),
    domain,
  );
  return data ?? [];
}

/**
 * Specific recipes by id, for surfaces that hold ids rather than a query —
 * favorites today. The domain filter is what lets those surfaces offer a
 * Bar/Kitchen split without a second table.
 */
export async function getRecipesByIds(
  client: RecipeClient,
  ids: number[],
  domain: DomainFilter,
): Promise<{ recipes: RecipePreview[]; error: string | null }> {
  if (ids.length === 0) return { recipes: [], error: null };
  const { data, error } = await scopeToDomain(
    client.from("recipes").select(CARD_COLUMNS).in("id", ids),
    domain,
  ).order("name");
  return { recipes: data ?? [], error: error?.message ?? null };
}

/** Published slugs, for generateStaticParams and the sitemap. */
export async function getPublishedRecipeSlugs(
  client: RecipeClient,
  domain: DomainFilter,
): Promise<{ slug: string; updated_at: string }[]> {
  const { data, error } = await scopeToDomain(
    client
      .from("recipes")
      .select("slug,updated_at")
      .eq("is_published", true),
    domain,
  ).order("slug");
  if (error) throw new Error(`Couldn’t list recipe slugs: ${error.message}`);
  return data ?? [];
}

export type RecipeDetail = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "domain"
  | "method"
  | "glass"
  | "garnish"
  | "instructions"
  | "image_url"
  | "source"
  | "strength"
  | "difficulty"
  | "flavor_tags"
>;

/**
 * One recipe by slug. Slugs are unique across the whole catalog, so this
 * takes no domain: the row reports which domain it belongs to and the detail
 * page composes itself from that (plan §9.4).
 */
export async function getRecipeBySlug(
  client: RecipeClient,
  slug: string,
): Promise<RecipeDetail | null> {
  const { data, error } = await client
    .from("recipes")
    .select(
      "id,slug,name,description,domain,method,glass,garnish,instructions,image_url,source,strength,difficulty,flavor_tags",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t load this recipe: ${error.message}`);
  return data;
}
