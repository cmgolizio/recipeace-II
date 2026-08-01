// Domain-aware recipe reads (expansion phase 2), at the SQL level: the
// catalog listing, the shared ingredient page, and "more like this". Runs
// against the real migrations + seeds via PGlite (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, recipeIdBySlug, seedFoodFixture } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodFixture(db);
});

afterAll(async () => {
  await db.close();
});

/** The catalog listing /recipes issues, with the domain predicate applied. */
async function catalog(
  domain: "cocktail" | "food" | "all",
  { limit, offset }: { limit?: number; offset?: number } = {},
): Promise<{ slug: string; domain: string }[]> {
  const { rows } = await db.query<{ slug: string; domain: string }>(
    `select slug, domain from public.recipes
     where is_published
       and ($1::public.recipe_domain is null or domain = $1::public.recipe_domain)
     order by name
     limit $2::int offset $3::int`,
    [domain === "all" ? null : domain, limit ?? 100, offset ?? 0],
  );
  return rows;
}

test("a cocktail listing returns only cocktails", async () => {
  const rows = await catalog("cocktail");
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => r.domain === "cocktail")).toBe(true);
});

test("a food listing returns only food", async () => {
  const rows = await catalog("food");
  expect(rows.map((r) => r.slug).sort()).toEqual([
    "berry-basil-salad",
    "cucumber-mint-salad",
    "rum-lime-sorbet",
  ]);
});

test("an all-domain listing returns both", async () => {
  const all = await catalog("all");
  const domains = new Set(all.map((r) => r.domain));
  expect(domains).toEqual(new Set(["cocktail", "food"]));
  expect(all).toHaveLength(
    (await catalog("cocktail")).length + (await catalog("food")).length,
  );
});

test("pagination stays inside the domain", async () => {
  const all = await catalog("food");
  const firstTwo = await catalog("food", { limit: 2 });
  const rest = await catalog("food", { limit: 2, offset: 2 });
  expect(firstTwo.map((r) => r.slug)).toEqual(
    all.slice(0, 2).map((r) => r.slug),
  );
  expect(rest.map((r) => r.slug)).toEqual(all.slice(2).map((r) => r.slug));
  expect(rest.every((r) => r.domain === "food")).toBe(true);
});

type DetailRecipe = { slug: string; domain: string };

async function ingredientRecipes(
  slug: string,
  domain?: "cocktail" | "food",
): Promise<DetailRecipe[]> {
  const call =
    domain === undefined
      ? "public.ingredient_detail($1)"
      : "public.ingredient_detail($1, $2::public.recipe_domain)";
  const { rows } = await db.query<{ recipes: DetailRecipe[] }>(
    `select recipes from ${call}`,
    domain === undefined ? [slug] : [slug, domain],
  );
  return rows[0]?.recipes ?? [];
}

test("a shared ingredient page lists both domains by default", async () => {
  // lime juice is in the daiquiri and in the sorbet.
  const recipes = await ingredientRecipes("lime-juice");
  const slugs = recipes.map((r) => r.slug);
  expect(slugs).toContain("daiquiri");
  expect(slugs).toContain("rum-lime-sorbet");
  expect(new Set(recipes.map((r) => r.domain))).toEqual(
    new Set(["cocktail", "food"]),
  );
});

test("an ingredient page can ask for one domain", async () => {
  const food = await ingredientRecipes("lime-juice", "food");
  expect(food.map((r) => r.slug)).toEqual(["rum-lime-sorbet"]);

  const cocktails = await ingredientRecipes("lime-juice", "cocktail");
  expect(cocktails.every((r) => r.domain === "cocktail")).toBe(true);
  expect(cocktails.map((r) => r.slug)).toContain("daiquiri");
  expect(cocktails.map((r) => r.slug)).not.toContain("rum-lime-sorbet");
});

test("more-like-this never crosses domains", async () => {
  // The sorbet and the daiquiri share every required ingredient; only the
  // domain filter keeps them apart.
  const sorbetId = await recipeIdBySlug(db, "rum-lime-sorbet");
  const { rows: forSorbet } = await db.query<{ slug: string }>(
    "select slug from public.related_recipes($1::bigint, 10)",
    [sorbetId],
  );
  expect(forSorbet.map((r) => r.slug)).not.toContain("daiquiri");

  const daiquiriId = await recipeIdBySlug(db, "daiquiri");
  const { rows: forDaiquiri } = await db.query<{ slug: string }>(
    "select slug from public.related_recipes($1::bigint, 10)",
    [daiquiriId],
  );
  expect(forDaiquiri.map((r) => r.slug)).not.toContain("rum-lime-sorbet");
  // ...and the cocktail neighbours it always had are still there.
  expect(forDaiquiri.map((r) => r.slug)).toContain("mojito");
});
