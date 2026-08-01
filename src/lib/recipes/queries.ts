// Recipe data access. One implementation per question the product asks,
// each taking an explicit domain (docs/expansion-plan.md §10).
//
// Domain filtering happens here — in the database query — never in the
// browser after the fact. Catalog reads go through the per-domain views
// (`cocktail_recipes`, `food_recipes`), which flatten each domain's detail
// table onto the shared recipe fields so filtering, sorting and paging still
// happen in one query.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Enums, Tables } from "../../types/database";
import type { DomainFilter, RecipeDomain } from "./domain";
import { formatMinutes, RECIPE_DOMAINS } from "./domain";

export type RecipeClient = SupabaseClient<Database>;

const COCKTAIL_CARD_COLUMNS =
  "id,slug,name,description,domain,image_url,method,glass,strength";
const FOOD_CARD_COLUMNS =
  "id,slug,name,description,domain,image_url,course,total_minutes";

/**
 * What a recipe card renders (plan §10.3). `pills` is the domain's short
 * metadata, already resolved — method and glass for a drink, course and time
 * for a dish — so cards compose instead of branching on flags (§14.2).
 */
export type RecipePreview = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  domain: RecipeDomain;
  image_url: string | null;
  pills: string[];
};

type CocktailCardRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  domain: RecipeDomain;
  image_url: string | null;
  method: string | null;
  glass: string | null;
};

type FoodCardRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  domain: RecipeDomain;
  image_url: string | null;
  course: string | null;
  total_minutes: number | null;
};

function toPreview(row: CocktailCardRow | FoodCardRow): RecipePreview {
  const pills =
    "method" in row
      ? [row.method, row.glass]
      : [row.course, row.total_minutes != null ? formatMinutes(row.total_minutes) : null];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    domain: row.domain,
    image_url: row.image_url,
    pills: pills.filter((p): p is string => !!p),
  };
}

/** `strength` is a Bar sort, `time` a Kitchen one; both fall back to name. */
export type RecipeSort = "name" | "newest" | "strength" | "time";

export type RecipeListFilters = {
  q: string;
  sort: RecipeSort;
  /** Shared across domains. */
  difficulty: "" | Enums<"recipe_difficulty">;
  /** Bar facets; ignored outside the cocktail domain. */
  method: string;
  glass: string;
  spirit: string;
  tags: string[];
  /** Kitchen facets; ignored outside the food domain. */
  course: string;
  cuisine: string;
  /** Upper bound on total time, in minutes. 0 means unfiltered. */
  maxMinutes: number;
};

export const EMPTY_FILTERS: RecipeListFilters = {
  q: "",
  sort: "name",
  difficulty: "",
  method: "",
  glass: "",
  spirit: "",
  tags: [],
  course: "",
  cuisine: "",
  maxMinutes: 0,
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

/**
 * The subset of the PostgREST builder the shared catalog logic uses. The two
 * domain views have different columns, so supabase-js infers a different
 * builder type for each; this is the one structural seam that lets the
 * filtering, sorting and paging below stay a single implementation instead of
 * being written out once per domain.
 */
type CatalogQuery = {
  eq(column: string, value: unknown): CatalogQuery;
  lte(column: string, value: unknown): CatalogQuery;
  in(column: string, values: unknown[]): CatalogQuery;
  or(filters: string): CatalogQuery;
  contains(column: string, value: string[]): CatalogQuery;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): CatalogQuery;
  range(from: number, to: number): CatalogQuery;
  then: PromiseLike<{
    data: unknown[] | null;
    count?: number | null;
    error: { message: string } | null;
  }>["then"];
};

/** Select a domain's catalog view with the columns its cards need. */
function catalogQuery(
  client: RecipeClient,
  domain: RecipeDomain,
  options?: { count: "exact" },
): CatalogQuery {
  const query =
    domain === "cocktail"
      ? client.from("cocktail_recipes").select(COCKTAIL_CARD_COLUMNS, options)
      : client.from("food_recipes").select(FOOD_CARD_COLUMNS, options);
  return query as unknown as CatalogQuery;
}

/** One page of a domain's published catalog, filtered and sorted. */
export async function getRecipes(
  client: RecipeClient,
  {
    domain,
    filters = EMPTY_FILTERS,
    page = 1,
    pageSize = 24,
  }: {
    domain: RecipeDomain;
    filters?: RecipeListFilters;
    page?: number;
    pageSize?: number;
  },
): Promise<RecipeListResult> {
  const from = (page - 1) * pageSize;
  const cocktails = domain === "cocktail";
  let query = catalogQuery(client, domain, { count: "exact" })
    .eq("is_published", true)
    .range(from, from + pageSize - 1);

  query =
    filters.sort === "newest"
      ? query.order("created_at", { ascending: false }).order("name")
      : filters.sort === "strength" && cocktails
        ? query
            .order("strength", { ascending: false, nullsFirst: false })
            .order("name")
        : filters.sort === "time" && !cocktails
          ? query
              .order("total_minutes", { ascending: true, nullsFirst: false })
              .order("name")
          : query.order("name");

  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (cocktails) {
    if (filters.method) query = query.eq("method", filters.method);
    if (filters.glass) query = query.eq("glass", filters.glass);
    if (filters.spirit) query = query.eq("base_spirit", filters.spirit);
    if (filters.tags.length > 0)
      query = query.contains("flavor_tags", filters.tags);
  } else {
    if (filters.course) query = query.eq("course", filters.course);
    if (filters.cuisine) query = query.eq("cuisine", filters.cuisine);
    if (filters.maxMinutes > 0)
      query = query.lte("total_minutes", filters.maxMinutes);
  }
  if (filters.q) {
    const pattern = ilikePattern(filters.q);
    query = query.or(`name.ilike."${pattern}",description.ilike."${pattern}"`);
  }

  const { data, count, error } = await query;
  return {
    recipes: ((data ?? []) as (CocktailCardRow | FoodCardRow)[]).map(toPreview),
    total: count ?? 0,
    error: error?.message ?? null,
  };
}

export type CocktailFacetRow = Pick<
  Tables<"cocktail_recipes">,
  "method" | "glass" | "difficulty" | "base_spirit" | "flavor_tags"
>;

/**
 * Facet values for the Bar filter controls, taken from the whole cocktail
 * catalog rather than the current page so switching a value never dead-ends
 * the controls. Facets are domain-shaped by nature — the Kitchen gets its own.
 */
export async function getCocktailFacets(
  client: RecipeClient,
): Promise<CocktailFacetRow[]> {
  const { data } = await client
    .from("cocktail_recipes")
    .select("method,glass,difficulty,base_spirit,flavor_tags")
    .eq("is_published", true);
  return data ?? [];
}

export type FoodFacetRow = Pick<
  Tables<"food_recipes">,
  "course" | "cuisine" | "difficulty" | "total_minutes"
>;

/** Facet values for the Kitchen filter controls. */
export async function getFoodFacets(
  client: RecipeClient,
): Promise<FoodFacetRow[]> {
  const { data } = await client
    .from("food_recipes")
    .select("course,cuisine,difficulty,total_minutes")
    .eq("is_published", true);
  return data ?? [];
}

/**
 * Specific recipes by id, for surfaces that hold ids rather than a query —
 * favorites today. A mixed list reads each domain's catalog and merges, which
 * keeps every row domain-filtered in the database and every card's metadata
 * correct for its own domain.
 */
export async function getRecipesByIds(
  client: RecipeClient,
  ids: number[],
  domain: DomainFilter,
): Promise<{ recipes: RecipePreview[]; error: string | null }> {
  if (ids.length === 0) return { recipes: [], error: null };
  const domains = domain === "all" ? RECIPE_DOMAINS : [domain];

  const results = await Promise.all(
    domains.map((d) => catalogQuery(client, d).in("id", ids)),
  );
  const failure = results.find((r) => r.error);
  if (failure?.error) return { recipes: [], error: failure.error.message };

  const recipes = results
    .flatMap((r) => (r.data ?? []) as (CocktailCardRow | FoodCardRow)[])
    .map(toPreview)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { recipes, error: null };
}

/** Published slugs, for generateStaticParams and the sitemap. */
export async function getPublishedRecipeSlugs(
  client: RecipeClient,
  domain: DomainFilter,
): Promise<{ slug: string; updated_at: string }[]> {
  let query = client
    .from("recipes")
    .select("slug,updated_at")
    .eq("is_published", true);
  if (domain !== "all") query = query.eq("domain", domain);
  const { data, error } = await query.order("slug");
  if (error) throw new Error(`Couldn’t list recipe slugs: ${error.message}`);
  return data ?? [];
}

export type CocktailDetails = Omit<
  Tables<"cocktail_recipe_details">,
  "recipe_id"
>;
export type FoodDetails = Omit<Tables<"food_recipe_details">, "recipe_id">;

type RecipeDetailShared = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "instructions"
  | "image_url"
  | "source"
  | "difficulty"
>;

/**
 * A recipe and the metadata of its own domain — never the other one's. The
 * union is what lets the detail page compose per domain instead of testing
 * flags (plan §9.4).
 */
export type RecipeDetail = RecipeDetailShared &
  (
    | { domain: "cocktail"; cocktail: CocktailDetails | null }
    | { domain: "food"; food: FoodDetails | null }
  );

/**
 * One recipe by slug. Slugs are unique across the whole catalog, so this takes
 * no domain: the row reports which domain it belongs to, and its detail row is
 * fetched from there.
 */
export async function getRecipeBySlug(
  client: RecipeClient,
  slug: string,
): Promise<RecipeDetail | null> {
  const { data: recipe, error } = await client
    .from("recipes")
    .select(
      "id,slug,name,description,domain,instructions,image_url,source,difficulty",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t load this recipe: ${error.message}`);
  if (!recipe) return null;

  if (recipe.domain === "cocktail") {
    const { data } = await client
      .from("cocktail_recipe_details")
      .select("method,glass,garnish,strength,base_spirit,flavor_tags")
      .eq("recipe_id", recipe.id)
      .maybeSingle();
    return { ...recipe, domain: "cocktail", cocktail: data };
  }
  const { data } = await client
    .from("food_recipe_details")
    .select("prep_minutes,cook_minutes,total_minutes,servings,course,cuisine")
    .eq("recipe_id", recipe.id)
    .maybeSingle();
  return { ...recipe, domain: "food", food: data };
}
