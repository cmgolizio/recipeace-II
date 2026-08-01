// Domain-specific recipe metadata (expansion phase 5): the two detail tables,
// their backfill, the catalog views built on them, and the invariant that a
// recipe only ever carries its own domain's metadata.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, seedFoodFixture } from "./db";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodFixture(db);
});

afterAll(async () => {
  await db.close();
});

test("every cocktail was backfilled with exactly one details row", async () => {
  const { rows } = await db.query<{ recipes: number; details: number }>(`
    select
      (select count(*)::int from public.recipes where domain = 'cocktail') as recipes,
      (select count(*)::int from public.cocktail_recipe_details) as details
  `);
  expect(rows[0].recipes).toBeGreaterThan(0);
  expect(rows[0].details).toBe(rows[0].recipes);
});

test("the backfill carried the drink metadata across intact", async () => {
  const { rows } = await db.query<{
    method: string | null;
    glass: string | null;
    garnish: string | null;
  }>(
    `select d.method, d.glass, d.garnish
     from public.cocktail_recipe_details d
     join public.recipes r on r.id = d.recipe_id
     where r.slug = 'old-fashioned'`,
  );
  expect(rows[0]).toEqual({
    method: "stirred",
    glass: "rocks",
    garnish: "Orange twist",
  });
});

test("a recipe can hold at most one details row per domain", async () => {
  const { rows } = await db.query<{ id: number }>(
    "select id::int as id from public.recipes where slug = 'daiquiri'",
  );
  await expect(
    db.query(
      "insert into public.cocktail_recipe_details (recipe_id, method) values ($1, 'shaken')",
      [rows[0].id],
    ),
  ).rejects.toThrow(/duplicate key|unique/i);
});

test("deleting a recipe takes its details with it", async () => {
  await db.exec(`
    insert into public.recipes (slug, name, domain, is_published)
    values ('test-detail-cascade', 'Cascade', 'food', true);
    insert into public.food_recipe_details (recipe_id, servings, course)
    select id, 4, 'main' from public.recipes where slug = 'test-detail-cascade';
  `);
  await db.exec("delete from public.recipes where slug = 'test-detail-cascade'");
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from public.food_recipe_details",
  );
  expect(rows[0].count).toBe(0);
});

test("details cannot outlive their recipe, or exist without one", async () => {
  await expect(
    db.query(
      "insert into public.food_recipe_details (recipe_id, servings) values (987654321, 2)",
    ),
  ).rejects.toThrow(/foreign key/i);
});

test("implausible metadata is rejected at the database", async () => {
  const { rows } = await db.query<{ id: number }>(
    "select id::int as id from public.recipes where slug = 'berry-basil-salad'",
  );
  await expect(
    db.query(
      "insert into public.food_recipe_details (recipe_id, servings) values ($1, 0)",
      [rows[0].id],
    ),
  ).rejects.toThrow(/check constraint/i);
  await expect(
    db.query(
      "insert into public.food_recipe_details (recipe_id, prep_minutes) values ($1, -5)",
      [rows[0].id],
    ),
  ).rejects.toThrow(/check constraint/i);
});

test("no recipe carries the other domain's metadata", async () => {
  // The invariant the writers are responsible for (plan §8.3): enforced by
  // the insert paths, asserted here rather than by a cross-table trigger.
  const { rows } = await db.query<{ slug: string }>(`
    select r.slug from public.recipes r
    join public.cocktail_recipe_details d on d.recipe_id = r.id
    where r.domain <> 'cocktail'
    union all
    select r.slug from public.recipes r
    join public.food_recipe_details d on d.recipe_id = r.id
    where r.domain <> 'food'
  `);
  expect(rows).toEqual([]);
});

test("each catalog view shows one domain, with its details flattened on", async () => {
  const { rows: cocktails } = await db.query<{
    slug: string;
    domain: string;
    method: string | null;
    flavor_tags: string[];
  }>("select slug, domain, method, flavor_tags from public.cocktail_recipes");
  expect(cocktails.length).toBeGreaterThan(0);
  expect(cocktails.every((r) => r.domain === "cocktail")).toBe(true);
  expect(cocktails.find((r) => r.slug === "daiquiri")?.method).toBe("shaken");
  // Never null, even for a cocktail with no tags recorded.
  expect(cocktails.every((r) => Array.isArray(r.flavor_tags))).toBe(true);

  const { rows: food } = await db.query<{ slug: string; domain: string }>(
    "select slug, domain from public.food_recipes",
  );
  expect(food.map((r) => r.slug).sort()).toEqual([
    "berry-basil-salad",
    "cucumber-mint-salad",
    "rum-lime-sorbet",
  ]);
});

test("food metadata surfaces through the view and the match card", async () => {
  await db.exec(`
    insert into public.food_recipe_details
      (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
    select id, 10, 0, 10, 2, 'salad', 'italian'
    from public.recipes where slug = 'berry-basil-salad'
    on conflict (recipe_id) do update set
      total_minutes = excluded.total_minutes, servings = excluded.servings,
      course = excluded.course, cuisine = excluded.cuisine;
  `);
  try {
    const { rows } = await db.query<{
      total_minutes: number;
      servings: number;
      course: string;
      cuisine: string;
    }>(
      `select total_minutes, servings, course, cuisine
       from public.food_recipes where slug = 'berry-basil-salad'`,
    );
    expect(rows[0]).toEqual({
      total_minutes: 10,
      servings: 2,
      course: "salad",
      cuisine: "italian",
    });

    const { rows: matches } = await db.query<{
      slug: string;
      metadata: Record<string, unknown>;
    }>(
      `select slug, metadata from public.match_recipes_detail(
         (select array_agg(id) from public.ingredients
          where name in ('strawberry', 'fresh basil', 'lemon')),
         0, 'food'::public.recipe_domain)`,
    );
    expect(matches.map((m) => m.slug)).toEqual(["berry-basil-salad"]);
    // A food card carries food metadata — no drink keys, no nulls.
    expect(matches[0].metadata).toEqual({
      total_minutes: 10,
      servings: 2,
      course: "salad",
    });
  } finally {
    await db.exec("delete from public.food_recipe_details");
  }
});
