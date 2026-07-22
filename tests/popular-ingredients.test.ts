// popular_ingredients tests: exercise the real SQL function against the real
// migrations and seed data (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb } from "./db";

type PopularRow = { id: number; name: string; recipe_count: number };

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

/** popular_ingredients rows. `maxResults` undefined = use the SQL default. */
async function popularIngredients(maxResults?: number): Promise<PopularRow[]> {
  const call =
    maxResults === undefined
      ? "public.popular_ingredients()"
      : "public.popular_ingredients($1::int)";
  const { rows } = await db.query<PopularRow>(
    `select id::int as id, name, recipe_count::int as recipe_count from ${call}`,
    maxResults === undefined ? [] : [maxResults],
  );
  return rows;
}

test("ranks ingredients by required-recipe count, ties broken by name", async () => {
  const rows = await popularIngredients();

  // In the test seed, lime juice and simple syrup are each required by 4
  // recipes — the top of the list, alphabetically ordered within the tie.
  expect(rows[0]).toMatchObject({ name: "lime juice", recipe_count: 4 });
  expect(rows[1]).toMatchObject({ name: "simple syrup", recipe_count: 4 });

  const counts = rows.map((r) => r.recipe_count);
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
});

test("counts only required uses and excludes garnish-category ingredients", async () => {
  const rows = await popularIngredients(50);
  const names = rows.map((r) => r.name);

  // Garnish-category ingredients never appear, however often they're used.
  expect(names).not.toContain("lime wheel");
  expect(names).not.toContain("orange twist");

  // Egg white's only use (whiskey sour) is optional, so it doesn't appear.
  expect(names).not.toContain("egg white");

  // Angostura bitters is required by 2 recipes (old fashioned, manhattan);
  // its optional garnish dash on the whiskey sour is not counted.
  const bitters = rows.find((r) => r.name === "angostura bitters");
  expect(bitters).toBeDefined();
  expect(bitters!.recipe_count).toBe(2);
});

test("staples are excluded even when a recipe requires them", async () => {
  // No seeded recipe requires a staple, so use a fixture: a recipe needing
  // gin plus sugar (a staple). Sugar must still not be suggested.
  await db.exec(`
    insert into public.recipes (slug, name, is_published)
    values ('test-popular-staple-fixture', 'Popular Staple Fixture', true);
    insert into public.recipe_ingredients (recipe_id, ingredient_id, display_order)
    select r.id, i.id, i.ord
    from public.recipes r,
         (select id, 1 as ord from public.ingredients where name = 'gin'
          union all
          select id, 2 from public.ingredients where name = 'sugar') i
    where r.slug = 'test-popular-staple-fixture';
  `);
  try {
    const rows = await popularIngredients(50);
    expect(rows.map((r) => r.name)).not.toContain("sugar");

    // The fixture's gin requirement does count.
    const gin = rows.find((r) => r.name === "gin");
    expect(gin!.recipe_count).toBe(3);
  } finally {
    // Cascades to recipe_ingredients; keeps later tests on pure seed data.
    await db.exec(
      "delete from public.recipes where slug = 'test-popular-staple-fixture'",
    );
  }
});

test("respects max_results and defaults to 8", async () => {
  expect(await popularIngredients(1)).toHaveLength(1);
  expect(await popularIngredients()).toHaveLength(8);
});