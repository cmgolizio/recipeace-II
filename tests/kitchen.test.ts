// Kitchen browsing and matching (expansion phases 10 and 11), against the
// real curated catalog: the filters the Kitchen offers, the pagination, and
// the matcher behaviour the pages render.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { matchPills, formatMinutes } from "../src/lib/recipes/domain";
import {
  EMPTY_FILTERS,
  getFoodFacets,
  getRecipes,
  type RecipeClient,
} from "../src/lib/recipes/queries";
import { createSeededDb, ingredientIds, seedFoodCatalog } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodCatalog(db);
});

afterAll(async () => {
  await db.close();
});

// ── The catalog page's query, at the SQL level ──────────────────────────────

async function catalog(where: string, params: unknown[] = []) {
  const { rows } = await db.query<{ slug: string; total_minutes: number }>(
    `select slug, total_minutes from public.food_recipes
     where is_published ${where}
     order by name`,
    params,
  );
  return rows;
}

test("the Kitchen catalog view only ever shows food", async () => {
  const { rows } = await db.query<{ domain: string }>(
    "select distinct domain from public.food_recipes",
  );
  expect(rows).toEqual([{ domain: "food" }]);
});

test("course, cuisine, time and difficulty all narrow the catalog", async () => {
  const breakfasts = await catalog("and course = 'breakfast'");
  expect(breakfasts.map((r) => r.slug)).toEqual([
    "banana-pancakes",
    "overnight-oats",
    "soft-scrambled-eggs-on-toast",
  ]);

  const italian = await catalog("and cuisine = 'italian'");
  expect(italian.map((r) => r.slug)).toEqual([
    "garlic-butter-spaghetti",
    "spaghetti-with-tomato-sauce",
  ]);

  const quick = await catalog("and total_minutes <= 15");
  expect(quick.length).toBeGreaterThan(0);
  expect(quick.every((r) => r.total_minutes <= 15)).toBe(true);

  const easy = await catalog("and difficulty = 'easy'");
  expect(easy.length).toBeGreaterThan(0);
});

test("quickest-first sorting is by total time", async () => {
  const { rows } = await db.query<{ total_minutes: number }>(
    `select total_minutes from public.food_recipes
     where is_published order by total_minutes asc nulls last, name`,
  );
  const times = rows.map((r) => r.total_minutes);
  expect([...times].sort((a, b) => a - b)).toEqual(times);
});

test("the facet lists come from the whole catalog, not one page", async () => {
  const { rows } = await db.query<{ course: string }>(
    "select distinct course from public.food_recipes where course is not null order by course",
  );
  // Enough variety that the control is worth showing.
  expect(rows.length).toBeGreaterThanOrEqual(5);
});

// ── The query layer, against the same database ──────────────────────────────

/**
 * A Supabase-shaped client backed by PGlite: enough of the builder for the
 * catalog queries, so the real query layer can be exercised end to end.
 */
function pgliteClient(): RecipeClient {
  type Part = { sql: string; params: unknown[] };
  const build = (table: string, columns: string, wantCount: boolean) => {
    const wheres: Part[] = [];
    const orders: string[] = [];
    let limit = "";
    const self = {
      eq(column: string, value: unknown) {
        wheres.push({ sql: `${column} = $?`, params: [value] });
        return self;
      },
      lte(column: string, value: unknown) {
        wheres.push({ sql: `${column} <= $?`, params: [value] });
        return self;
      },
      in(column: string, values: unknown[]) {
        wheres.push({ sql: `${column} = any($?)`, params: [values] });
        return self;
      },
      or() {
        return self;
      },
      contains(column: string, value: string[]) {
        wheres.push({ sql: `${column} @> $?`, params: [value] });
        return self;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orders.push(`${column} ${options?.ascending === false ? "desc" : "asc"}`);
        return self;
      },
      range(from: number, to: number) {
        limit = ` limit ${to - from + 1} offset ${from}`;
        return self;
      },
      async then(resolve: (value: unknown) => unknown) {
        const params: unknown[] = [];
        const clauses = wheres.map((w) =>
          w.sql.replace("$?", () => {
            params.push(w.params[0]);
            return `$${params.length}`;
          }),
        );
        const where = clauses.length > 0 ? ` where ${clauses.join(" and ")}` : "";
        const order = orders.length > 0 ? ` order by ${orders.join(", ")}` : "";
        const { rows } = await db.query<Record<string, unknown>>(
          `select ${columns} from public.${table}${where}${order}${limit}`,
          params,
        );
        const count = wantCount
          ? (
              await db.query<{ count: number }>(
                `select count(*)::int as count from public.${table}${where}`,
                params,
              )
            ).rows[0].count
          : null;
        return resolve({ data: rows, count, error: null });
      },
    };
    return self;
  };
  return {
    from: (table: string) => ({
      select: (columns: string, options?: { count?: string }) =>
        build(table, columns, options?.count === "exact"),
    }),
  } as unknown as RecipeClient;
}

test("getRecipes returns Kitchen cards with food pills", async () => {
  const client = pgliteClient();
  const { recipes, total } = await getRecipes(client, {
    domain: "food",
    pageSize: 100,
  });

  expect(total).toBe(13);
  const soup = recipes.find((r) => r.slug === "lentil-soup");
  expect(soup).toBeDefined();
  expect(soup!.domain).toBe("food");
  // Course and total time — never a glass or a method.
  expect(soup!.pills).toEqual(["soup", formatMinutes(55)]);
});

test("a food filter narrows the page through the query layer", async () => {
  const client = pgliteClient();
  const { recipes } = await getRecipes(client, {
    domain: "food",
    filters: { ...EMPTY_FILTERS, course: "breakfast" },
    pageSize: 100,
  });
  expect(recipes.map((r) => r.slug).sort()).toEqual([
    "banana-pancakes",
    "overnight-oats",
    "soft-scrambled-eggs-on-toast",
  ]);
});

test("pagination hands back one page at a time", async () => {
  const client = pgliteClient();
  const first = await getRecipes(client, { domain: "food", pageSize: 5 });
  const second = await getRecipes(client, {
    domain: "food",
    page: 2,
    pageSize: 5,
  });
  expect(first.recipes).toHaveLength(5);
  expect(second.recipes).toHaveLength(5);
  expect(first.total).toBe(second.total);
  const overlap = first.recipes.filter((r) =>
    second.recipes.some((s) => s.id === r.id),
  );
  expect(overlap).toEqual([]);
});

test("the Kitchen's facet options are food's, not the Bar's", async () => {
  const facets = await getFoodFacets(pgliteClient());
  expect(facets.length).toBe(13);
  expect(Object.keys(facets[0]).sort()).toEqual([
    "course",
    "cuisine",
    "difficulty",
    "total_minutes",
  ]);
});

// ── What the matches page renders ───────────────────────────────────────────

test("Kitchen matches are ranked, food-only, and carry food pills", async () => {
  const pantry = await ingredientIds(db, [
    "sliced bread",
    "cheddar cheese",
    "butter",
    "whole egg",
    "milk",
    "rolled oats",
    "honey",
  ]);
  const { rows } = await db.query<{
    slug: string;
    domain: string;
    metadata: Record<string, string | number>;
    missing_count: number;
  }>(
    `select slug, domain, metadata, missing_count
     from public.match_recipes_detail($1::bigint[], 2, 'food'::public.recipe_domain)`,
    [pantry],
  );

  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.domain === "food")).toBe(true);
  // Ranked fewest-missing first, which is what the page's sections rely on.
  const missing = rows.map((r) => r.missing_count);
  expect([...missing].sort((a, b) => a - b)).toEqual(missing);

  const grilled = rows.find((r) => r.slug === "grilled-cheese-sandwich");
  expect(grilled!.missing_count).toBe(0);
  expect(matchPills("food", grilled!.metadata)).toEqual([
    "sandwich",
    formatMinutes(10),
  ]);
});

test("the staple note tells the truth about what matching assumes", async () => {
  const { rows } = await db.query<{ name: string }>(
    "select name from public.ingredients where is_staple order by name",
  );
  // The note renders exactly this list; the policy is five ingredients (§11.4).
  expect(rows.map((r) => r.name)).toEqual([
    "crushed ice",
    "ice",
    "salt",
    "sugar",
    "water",
  ]);
});

test("a missing ingredient is named so it can be added to the shopping list", async () => {
  const pantry = await ingredientIds(db, ["spaghetti", "olive oil", "butter"]);
  const { rows } = await db.query<{
    slug: string;
    missing_ingredients: string[];
  }>(
    `select slug, missing_ingredients
     from public.match_recipes_detail($1::bigint[], 2, 'food'::public.recipe_domain)`,
    [pantry],
  );
  const garlicky = rows.find((r) => r.slug === "garlic-butter-spaghetti");
  expect(garlicky!.missing_ingredients).toEqual(["garlic", "parmesan cheese"]);
});
