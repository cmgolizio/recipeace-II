// The curated food catalog (expansion phase 9), applied to a real database:
// the data itself, and the product behaviour it has to support — Kitchen
// matching over a shared pantry, without disturbing the Bar.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { foodCatalog } from "../src/data/food-seed";
import { ingestCatalog } from "../scripts/pipeline/domains/food/ingest";
import { isClean } from "../scripts/pipeline/core/report";
import { createSeededDb, ingredientIds, seedFoodCatalog } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodCatalog(db);
});

afterAll(async () => {
  await db.close();
});

test("the shipped catalog validates cleanly", () => {
  // supabase/seed_food.sql is generated from this; if the source no longer
  // validates, the generated file is stale or wrong.
  const result = ingestCatalog(foodCatalog);
  expect(result.report.rejected).toEqual([]);
  expect(result.report.unresolved).toEqual([]);
  expect(isClean(result.report)).toBe(true);
  expect(result.recipes.length).toBeGreaterThanOrEqual(10);
});

test("the catalog is a coherent dataset in the database", async () => {
  const { rows } = await db.query<{
    recipes: number;
    detailed: number;
    unlicensed: number;
    unpublished: number;
    lines: number;
  }>(`
    select
      (select count(*)::int from public.recipes where domain = 'food') as recipes,
      (select count(*)::int from public.food_recipe_details) as detailed,
      (select count(*)::int from public.recipes
        where domain = 'food' and (source is null or license is null)) as unlicensed,
      (select count(*)::int from public.recipes
        where domain = 'food' and not is_published) as unpublished,
      (select count(*)::int from public.recipe_ingredients ri
        join public.recipes r on r.id = ri.recipe_id
        where r.domain = 'food') as lines
  `);
  expect(rows[0].recipes).toBe(foodCatalog.recipes.length);
  // Every food recipe has its detail row, and none is missing provenance.
  expect(rows[0].detailed).toBe(rows[0].recipes);
  expect(rows[0].unlicensed).toBe(0);
  expect(rows[0].unpublished).toBe(0);
  expect(rows[0].lines).toBeGreaterThan(80);
});

test("every food recipe has the metadata the Kitchen renders", async () => {
  const { rows } = await db.query<{ slug: string }>(`
    select r.slug from public.recipes r
    join public.food_recipe_details d on d.recipe_id = r.id
    where r.domain = 'food'
      and (d.servings is null or d.total_minutes is null or d.course is null)
  `);
  expect(rows).toEqual([]);
});

test("no food ingredient reference is left dangling", async () => {
  const { rows } = await db.query<{ count: number }>(`
    select count(*)::int as count
    from public.recipe_ingredients ri
    left join public.ingredients i on i.id = ri.ingredient_id
    where i.id is null
  `);
  expect(rows[0].count).toBe(0);
});

test("the catalog shares the cocktail ingredient catalog rather than copying it", async () => {
  // These are used by both domains. If food had duplicated them there would be
  // two rows per name, and the unique constraint would have failed the seed.
  const shared = [
    "lemon juice",
    "lime juice",
    "fresh mint",
    "fresh basil",
    "milk",
    "whole egg",
    "sugar",
    "salt",
    "strawberry",
    "cucumber",
  ];
  const { rows } = await db.query<{ name: string; uses: number }>(
    `select i.name, count(distinct r.domain)::int as uses
     from public.ingredients i
     join public.recipe_ingredients ri on ri.ingredient_id = i.id
     join public.recipes r on r.id = ri.recipe_id
     where i.name = any($1::text[])
     group by i.name
     having count(distinct r.domain) > 1
     order by i.name`,
    [shared],
  );
  // At least a few of them genuinely appear in both a drink and a dish.
  expect(rows.length).toBeGreaterThanOrEqual(3);
});

test("aliases resolve regional names onto the canonical rows", async () => {
  const { rows } = await db.query<{ alias: string; name: string }>(
    `select a.alias, i.name
     from public.ingredient_aliases a
     join public.ingredients i on i.id = a.ingredient_id
     where a.alias in ('scallions', 'coriander leaves', 'plain flour', 'porridge oats')
     order by a.alias`,
  );
  expect(rows).toEqual([
    { alias: "coriander leaves", name: "cilantro" },
    { alias: "plain flour", name: "all-purpose flour" },
    { alias: "porridge oats", name: "rolled oats" },
    { alias: "scallions", name: "green onion" },
  ]);
});

test("a stocked kitchen pantry produces real matches", async () => {
  const pantry = await ingredientIds(db, [
    "sliced bread",
    "cheddar cheese",
    "butter",
    "whole egg",
    "milk",
  ]);
  const { rows } = await db.query<{ slug: string; missing_count: number }>(
    `select r.slug, m.missing_count
     from public.match_recipes($1::bigint[], 0, 'food'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id`,
    [pantry],
  );
  const slugs = rows.map((r) => r.slug);
  expect(slugs).toContain("grilled-cheese-sandwich");
  expect(slugs).toContain("soft-scrambled-eggs-on-toast");
  expect(rows.every((r) => r.missing_count === 0)).toBe(true);
});

test("optional lines never stand between a cook and dinner", async () => {
  // The salad's feta and mint are optional; the vinaigrette needs none of them.
  const pantry = await ingredientIds(db, [
    "cucumber",
    "tomato",
    "red onion",
    "olive oil",
    "lemon juice",
    "black pepper",
  ]);
  const { rows } = await db.query<{ missing_count: number }>(
    `select m.missing_count
     from public.match_recipes($1::bigint[], 0, 'food'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id
     where r.slug = 'cucumber-tomato-salad'`,
    [pantry],
  );
  expect(rows[0].missing_count).toBe(0);
});

test("one pantry answers both domains", async () => {
  // Lemon juice and mint belong to a mojito and a salad alike.
  const pantry = await ingredientIds(db, [
    "lemon juice",
    "fresh mint",
    "white rum",
    "simple syrup",
    "soda water",
    "olive oil",
    "dijon mustard",
    "honey",
  ]);
  const food = await db.query<{ slug: string }>(
    `select r.slug from public.match_recipes($1::bigint[], 0, 'food'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id`,
    [pantry],
  );
  const bar = await db.query<{ slug: string }>(
    `select r.slug from public.match_recipes($1::bigint[], 0, 'cocktail'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id`,
    [pantry],
  );
  expect(food.rows.map((r) => r.slug)).toContain("lemon-vinaigrette");
  expect(bar.rows.map((r) => r.slug)).toContain("mojito");
});

test("the Bar is untouched by the food catalog", async () => {
  // The regression that matters: adding food must not change a drink result.
  const pantry = await ingredientIds(db, ["gin", "sweet vermouth"]);
  const { rows } = await db.query<{ slug: string }>(
    `select r.slug from public.match_recipes($1::bigint[], 2, 'cocktail'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id`,
    [pantry],
  );
  expect(rows.map((r) => r.slug)).toEqual([
    "gin-and-tonic",
    "negroni",
    "manhattan",
  ]);
});

test("a repeated line and its sections survive the round trip", async () => {
  const { rows } = await db.query<{
    name: string;
    section: string | null;
    preparation: string | null;
  }>(
    `select i.name, ri.section, ri.preparation
     from public.recipe_ingredients ri
     join public.recipes r on r.id = ri.recipe_id
     join public.ingredients i on i.id = ri.ingredient_id
     where r.slug = 'soft-scrambled-eggs-on-toast' and i.name = 'butter'
     order by ri.display_order`,
  );
  expect(rows).toHaveLength(2);
  expect(rows[1].preparation).toContain("for the toast");

  const { rows: sections } = await db.query<{ section: string }>(
    `select distinct ri.section
     from public.recipe_ingredients ri
     join public.recipes r on r.id = ri.recipe_id
     where r.slug = 'black-bean-tacos' and ri.section is not null
     order by ri.section`,
  );
  expect(sections.map((s) => s.section)).toEqual([
    "For the beans",
    "To serve",
  ]);
});
