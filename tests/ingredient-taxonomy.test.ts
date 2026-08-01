// The shared ingredient taxonomy (expansion phase 6): the food categories,
// and the guarantees the migration had to preserve while adding them.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb } from "./db";

/** Every food category the phase-6 migration added. */
const FOOD_CATEGORIES = [
  "meat",
  "seafood",
  "egg",
  "grain",
  "pasta",
  "bread",
  "legume",
  "canned_good",
  "oil_and_fat",
  "herb",
  "spice",
  "condiment",
  "sauce",
  "baking",
  "sweetener",
] as const;

/** The cocktail vocabulary, which had to survive untouched. */
const COCKTAIL_CATEGORIES = [
  "spirit",
  "liqueur",
  "fortified_wine",
  "wine",
  "bitters",
  "mixer",
  "juice",
  "syrup",
  "garnish",
] as const;

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

async function categoryValues(): Promise<string[]> {
  const { rows } = await db.query<{ value: string }>(
    `select e.enumlabel as value
     from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     where t.typname = 'ingredient_category'`,
  );
  return rows.map((r) => r.value);
}

test("food ingredients can be filed without abusing 'other'", async () => {
  const values = await categoryValues();
  for (const category of FOOD_CATEGORIES) expect(values).toContain(category);
});

test("the cocktail vocabulary is unchanged", async () => {
  const values = await categoryValues();
  for (const category of COCKTAIL_CATEGORIES) expect(values).toContain(category);
});

test("an unknown category is still rejected", async () => {
  await expect(
    db.query(
      "insert into public.ingredients (name, slug, category) values ('kryptonite', 'kryptonite', 'mineral')",
    ),
  ).rejects.toThrow(/invalid input value for enum/i);
});

test("seeded ingredients keep their identity across the taxonomy change", async () => {
  // The migration only adds enum values, so no row's id or slug can move.
  // Four categories were re-filed by hand in phase 9, once the vocabulary
  // existed to file them properly: eggs are `egg` rather than `dairy`, and
  // the two bar herbs are `herb`. Ids and slugs are untouched.
  const { rows } = await db.query<{
    name: string;
    slug: string;
    category: string;
  }>(
    `select name, slug, category from public.ingredients
     where name in ('bourbon', 'lime juice', 'fresh mint', 'salt')
     order by name`,
  );
  expect(rows).toEqual([
    { name: "bourbon", slug: "bourbon", category: "spirit" },
    { name: "fresh mint", slug: "fresh-mint", category: "herb" },
    { name: "lime juice", slug: "lime-juice", category: "juice" },
    { name: "salt", slug: "salt", category: "staple" },
  ]);
});

test("a food ingredient joins the one shared catalog", async () => {
  await db.exec(`
    insert into public.ingredients (name, slug, category)
    values ('all-purpose flour', 'all-purpose-flour', 'baking');
  `);
  try {
    const { rows } = await db.query<{
      category: string;
      is_staple: boolean;
    }>(
      "select category, is_staple from public.ingredients where slug = 'all-purpose-flour'",
    );
    // Category and staple status are independent questions: flour is a baking
    // ingredient, and matching does NOT assume you own it (phase 3 policy).
    expect(rows[0]).toEqual({ category: "baking", is_staple: false });

    // And it is searchable through the same RPC the pantry uses.
    const { rows: hits } = await db.query<{ name: string; category: string }>(
      "select name, category from public.search_ingredients('flour')",
    );
    expect(hits.map((h) => h.name)).toContain("all-purpose flour");
    expect(hits.find((h) => h.name === "all-purpose flour")?.category).toBe(
      "baking",
    );
  } finally {
    await db.exec(
      "delete from public.ingredients where slug = 'all-purpose-flour'",
    );
  }
});

test("the garnish exclusions still hold, because 'garnish' still exists", async () => {
  // popular_ingredients and related_recipes both filter category <> 'garnish'.
  // Extending the enum rather than replacing it is what keeps that valid.
  const { rows } = await db.query<{ name: string }>(
    "select name from public.popular_ingredients(50)",
  );
  const { rows: garnishes } = await db.query<{ name: string }>(
    "select name from public.ingredients where category = 'garnish'",
  );
  const listed = new Set(rows.map((r) => r.name));
  for (const g of garnishes) expect(listed.has(g.name)).toBe(false);
});
