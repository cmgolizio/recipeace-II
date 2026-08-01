import type { Metadata } from "next";
import Link from "next/link";

import { RecipeCard } from "../../../components/recipe-card";
import { RecipesFilter } from "../../../components/recipes-filter";
import {
  getCocktailFacets,
  getRecipes,
  type RecipeListFilters,
} from "../../../lib/recipes/queries";
import { createClient } from "../../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Cocktail recipes — In House Mixers",
  description:
    "Browse the cocktail catalog by method, glass, base spirit and flavour.",
  alternates: { canonical: "/bar/recipes" },
};

const PAGE_SIZE = 24;

// Enum order, not alphabetical — used for both parsing and facet display.
const DIFFICULTIES = ["easy", "medium", "advanced"] as const;

// This is the Bar catalog: cocktails only. Food browsing gets its own route
// under /kitchen rather than a mode switch here (docs/expansion-plan.md §9.2).
const DOMAIN = "cocktail" as const;

function pageHref(filters: RecipeListFilters, page: number) {
  const query: Record<string, string | string[]> = {};
  if (filters.q) query.q = filters.q;
  if (filters.method) query.method = filters.method;
  if (filters.glass) query.glass = filters.glass;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.spirit) query.spirit = filters.spirit;
  if (filters.tags.length > 0) query.tag = filters.tags;
  if (filters.sort !== "name") query.sort = filters.sort;
  if (page > 1) query.page = String(page);
  return { pathname: "/bar/recipes", query };
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function multi(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return values.map((v) => v.trim()).filter((v) => v !== "");
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sortParam = single(params.sort);
  // Narrowed to the enum here so the .eq() in the query layer type-checks
  // against the difficulty column.
  const difficulty =
    DIFFICULTIES.find((d) => d === single(params.difficulty)) ?? "";
  const filters: RecipeListFilters = {
    q: single(params.q),
    method: single(params.method),
    glass: single(params.glass),
    difficulty,
    spirit: single(params.spirit),
    tags: multi(params.tag),
    sort:
      sortParam === "newest"
        ? "newest"
        : sortParam === "strength"
          ? "strength"
          : "name",
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
    getCocktailFacets(supabase),
  ]);

  const facetValues = (key: "method" | "glass" | "base_spirit") =>
    [
      ...new Set(facetRows.map((r) => r[key]).filter((v): v is string => !!v)),
    ].sort();
  const methods = facetValues("method");
  const glasses = facetValues("glass");
  const spirits = facetValues("base_spirit");
  const difficulties = DIFFICULTIES.filter((d) =>
    facetRows.some((r) => r.difficulty === d),
  );
  const tagOptions = [
    ...new Set(facetRows.flatMap((r) => r.flavor_tags)),
  ].sort();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(
    filters.q ||
    filters.method ||
    filters.glass ||
    filters.difficulty ||
    filters.spirit ||
    filters.tags.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cocktail recipes
        </h1>
        <p className="text-muted">
          Browse the drinks catalog. Open any cocktail to see the full build and
          what you’re missing from your pantry.
        </p>
      </div>

      <RecipesFilter
        filters={filters}
        methods={methods}
        glasses={glasses}
        difficulties={difficulties}
        spirits={spirits}
        tagOptions={tagOptions}
      />

      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load recipes: {error}
        </p>
      )}
      {!error && total === 0 && !filtered && (
        <p className="text-muted">
          No recipes yet — check back soon.
          {process.env.NODE_ENV === "development" && (
            <>
              {" "}
              Run{" "}
              <code className="rounded bg-black/6 px-1 dark:bg-white/10">
                supabase/seed_test_recipes.sql
              </code>{" "}
              to add some.
            </>
          )}
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

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(filters, page - 1)}
              className="text-muted hover:text-foreground"
            >
              ← Previous
            </Link>
          ) : (
            <span aria-hidden className="opacity-30">
              ← Previous
            </span>
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(filters, page + 1)}
              className="text-muted hover:text-foreground"
            >
              Next →
            </Link>
          ) : (
            <span aria-hidden className="opacity-30">
              Next →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
