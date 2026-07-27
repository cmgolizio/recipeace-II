import Link from "next/link";

import { RecipeCard } from "../../components/recipe-card";
import {
  RecipesFilter,
  type RecipeFilters,
} from "../../components/recipes-filter";
import { createClient } from "../../lib/supabase/server";
import type { Tables } from "../../types/database";

const PAGE_SIZE = 24;

// Enum order, not alphabetical — used for both parsing and facet display.
const DIFFICULTIES = ["easy", "medium", "advanced"] as const;

type Recipe = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "method"
  | "glass"
  | "image_url"
  | "strength"
  | "difficulty"
  | "flavor_tags"
>;

function pageHref(filters: RecipeFilters, page: number) {
  const query: Record<string, string | string[]> = {};
  if (filters.q) query.q = filters.q;
  if (filters.method) query.method = filters.method;
  if (filters.glass) query.glass = filters.glass;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.spirit) query.spirit = filters.spirit;
  if (filters.tags.length > 0) query.tag = filters.tags;
  if (filters.sort !== "name") query.sort = filters.sort;
  if (page > 1) query.page = String(page);
  return { pathname: "/recipes", query };
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
  // Narrowed to the enum here so the .eq() below type-checks against the
  // difficulty column.
  const difficulty =
    DIFFICULTIES.find((d) => d === single(params.difficulty)) ?? "";
  const filters: RecipeFilters = {
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
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select(
      "id,slug,name,description,method,glass,image_url,strength,difficulty,flavor_tags",
      { count: "exact" },
    )
    .eq("is_published", true)
    .range(from, from + PAGE_SIZE - 1);
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
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (filters.spirit) query = query.eq("base_spirit", filters.spirit);
  if (filters.tags.length > 0) query = query.contains("flavor_tags", filters.tags);
  if (filters.q) {
    // The pattern is double-quoted because PostgREST's or= list treats , ( )
    // specially; backslash-escape the quote/backslash chars inside it.
    const pattern = `%${filters.q.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}%`;
    query = query.or(`name.ilike."${pattern}",description.ilike."${pattern}"`);
  }

  // Facet options come from the whole published catalog (not the filtered
  // page), so switching between values never dead-ends the controls.
  const [{ data, count, error }, { data: facetRows }] = await Promise.all([
    query,
    supabase
      .from("recipes")
      .select("method,glass,difficulty,base_spirit,flavor_tags")
      .eq("is_published", true),
  ]);

  const facetValues = (key: "method" | "glass" | "base_spirit") =>
    [
      ...new Set(
        (facetRows ?? []).map((r) => r[key]).filter((v): v is string => !!v),
      ),
    ].sort();
  const methods = facetValues("method");
  const glasses = facetValues("glass");
  const spirits = facetValues("base_spirit");
  const difficulties = DIFFICULTIES.filter((d) =>
    (facetRows ?? []).some((r) => r.difficulty === d),
  );
  const tagOptions = [
    ...new Set((facetRows ?? []).flatMap((r) => r.flavor_tags)),
  ].sort();

  const recipes: Recipe[] = data ?? [];
  const total = count ?? 0;
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
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <p className="text-muted">
          Browse the catalog. Open any cocktail to see the full build and what
          you’re missing from your bar.
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
          Couldn’t load recipes: {error.message}
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