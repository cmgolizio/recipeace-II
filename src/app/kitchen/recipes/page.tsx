import type { Metadata } from "next";

import { pageTitle } from "../../../lib/site";
import { FoodFilter } from "../../../components/food-filter";
import { Pagination } from "../../../components/pagination";
import { RecipeCard } from "../../../components/recipe-card";
import {
  EMPTY_FILTERS,
  getFoodFacets,
  getRecipes,
  type RecipeListFilters,
} from "../../../lib/recipes/queries";
import { createClient } from "../../../lib/supabase/server";

export const metadata: Metadata = {
  title: pageTitle("Food recipes"),
  description:
    "Browse the food catalog by course, cuisine, total time and difficulty.",
  alternates: { canonical: "/kitchen/recipes" },
};

const PAGE_SIZE = 24;

// Enum order, not alphabetical — used for both parsing and facet display.
const DIFFICULTIES = ["easy", "medium", "advanced"] as const;

const DOMAIN = "food" as const;

function pageHref(filters: RecipeListFilters, page: number) {
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.course) query.course = filters.course;
  if (filters.cuisine) query.cuisine = filters.cuisine;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.maxMinutes > 0) query.time = String(filters.maxMinutes);
  if (filters.sort !== "name") query.sort = filters.sort;
  if (page > 1) query.page = String(page);
  return { pathname: "/kitchen/recipes", query };
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function KitchenRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sortParam = single(params.sort);
  const difficulty =
    DIFFICULTIES.find((d) => d === single(params.difficulty)) ?? "";
  const minutes = Number.parseInt(single(params.time), 10);
  const filters: RecipeListFilters = {
    ...EMPTY_FILTERS,
    q: single(params.q),
    course: single(params.course),
    cuisine: single(params.cuisine),
    difficulty,
    maxMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 0,
    sort:
      sortParam === "newest" ? "newest" : sortParam === "time" ? "time" : "name",
  };
  const page = Math.max(1, Number.parseInt(single(params.page) || "1", 10) || 1);

  const supabase = await createClient();
  const [{ recipes, total, error }, facetRows] = await Promise.all([
    getRecipes(supabase, {
      domain: DOMAIN,
      filters,
      page,
      pageSize: PAGE_SIZE,
    }),
    getFoodFacets(supabase),
  ]);

  const facetValues = (key: "course" | "cuisine") =>
    [
      ...new Set(facetRows.map((r) => r[key]).filter((v): v is string => !!v)),
    ].sort();
  const difficulties = DIFFICULTIES.filter((d) =>
    facetRows.some((r) => r.difficulty === d),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(
    filters.q ||
    filters.course ||
    filters.cuisine ||
    filters.difficulty ||
    filters.maxMinutes > 0
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Food recipes</h1>
        <p className="text-muted">
          Browse the kitchen catalog. Open any recipe to see the full method and
          what you’re missing from your pantry.
        </p>
      </div>

      <FoodFilter
        filters={{ ...filters, sort: filters.sort }}
        courses={facetValues("course")}
        cuisines={facetValues("cuisine")}
        difficulties={difficulties}
      />

      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load recipes: {error}
        </p>
      )}
      {!error && total === 0 && !filtered && (
        <p className="text-muted">
          No food recipes yet — the Kitchen is still being stocked.
        </p>
      )}
      {!error && filtered && recipes.length === 0 && (
        <p className="text-muted">
          {filters.q
            ? `No recipes match “${filters.q}”.`
            : "No recipes match these filters."}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <RecipeCard recipe={r} />
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        totalPages={totalPages}
        href={(next) => pageHref(filters, next)}
      />
    </div>
  );
}