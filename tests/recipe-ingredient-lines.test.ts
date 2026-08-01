// Food-ready ingredient lines (expansion phase 7): repeated ingredients,
// sections, "to taste" amounts, and the guarantee that none of it changed how
// a cocktail is counted or rendered.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, ingredientIds, recipeIdBySlug } from "./db";
import { normalizeUnit, isKnownUnit } from "../src/lib/units/vocabulary";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  // A food recipe written the way food recipes actually are: two sections,
  // olive oil twice ("divided"), salt to taste, parsley for serving.
  await db.exec(`
    insert into public.recipes (slug, name, domain, instructions, is_published)
    values ('test-pasta', 'Test Pasta', 'food',
      array['Boil the pasta.', 'Make the sauce.', 'Toss and serve.'], true);

    insert into public.ingredients (name, slug, category) values
      ('spaghetti', 'spaghetti', 'pasta'),
      ('olive oil', 'olive-oil', 'oil_and_fat'),
      ('flat-leaf parsley', 'flat-leaf-parsley', 'herb')
    on conflict (name) do nothing;

    insert into public.recipe_ingredients
      (recipe_id, ingredient_id, amount, unit, preparation, is_optional, display_order, section)
    select r.id, i.id, v.amount::numeric, v.unit::text, v.prep::text,
           v.optional::boolean, v.display_order::int, v.section::text
    from (values
      ('spaghetti', 400, 'g', null, false, 1, 'For the pasta'),
      ('salt', null, null, 'to taste', false, 2, 'For the pasta'),
      ('olive oil', 2, 'tbsp', 'divided', false, 3, 'For the pasta'),
      ('olive oil', 1, 'tbsp', 'divided', false, 4, 'For the sauce'),
      ('lemon juice', 1, 'tbsp', null, false, 5, 'For the sauce'),
      ('flat-leaf parsley', null, null, 'for serving', true, 6, 'For the sauce')
    ) as v(ingredient_name, amount, unit, prep, optional, display_order, section)
    join public.recipes r on r.slug = 'test-pasta'
    join public.ingredients i on i.name = v.ingredient_name;
  `);
});

afterAll(async () => {
  await db.close();
});

test("an ingredient may appear on more than one line", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const { rows } = await db.query<{ display_order: number; section: string }>(
    `select ri.display_order, ri.section
     from public.recipe_ingredients ri
     join public.ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id = $1 and i.name = 'olive oil'
     order by ri.display_order`,
    [recipeId],
  );
  expect(rows).toEqual([
    { display_order: 3, section: "For the pasta" },
    { display_order: 4, section: "For the sauce" },
  ]);
});

test("a repeated ingredient is still required only once", async () => {
  // Olive oil twice must not make the recipe look like it needs two things.
  const pantry = await ingredientIds(db, ["spaghetti", "lemon juice"]);
  const { rows } = await db.query<{
    required_count: number;
    missing_count: number;
    missing_ingredients: string[];
  }>(
    `select m.required_count, m.missing_count, m.missing_ingredients
     from public.match_recipes($1::bigint[], null, 'food'::public.recipe_domain) m
     join public.recipes r on r.id = m.recipe_id
     where r.slug = 'test-pasta'`,
    [pantry],
  );
  // spaghetti, salt (a staple), olive oil, lemon juice — four, not five.
  expect(rows[0].required_count).toBe(4);
  expect(rows[0].missing_ingredients).toEqual(["olive oil"]);
  expect(rows[0].missing_count).toBe(1);
});

test("the pantry status of a repeated ingredient is reported once", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const pantry = await ingredientIds(db, ["spaghetti"]);
  const { rows } = await db.query<{ name: string; status: string }>(
    `select name, status from public.recipe_pantry_status($1::bigint, $2::bigint[])`,
    [recipeId, pantry],
  );
  expect(rows.filter((r) => r.name === "olive oil")).toHaveLength(1);
  // Ordering still follows the first line each ingredient appears on.
  expect(rows.map((r) => r.name)).toEqual([
    "spaghetti",
    "salt",
    "olive oil",
    "lemon juice",
    "flat-leaf parsley",
  ]);
});

test("an optional line never counts against the recipe", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const pantry = await ingredientIds(db, ["spaghetti"]);
  const { rows } = await db.query<{ name: string; is_optional: boolean }>(
    `select name, is_optional from public.recipe_pantry_status($1::bigint, $2::bigint[])`,
    [recipeId, pantry],
  );
  expect(rows.find((r) => r.name === "flat-leaf parsley")?.is_optional).toBe(
    true,
  );
});

test("a to-taste line has no amount and no unit", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const { rows } = await db.query<{
    amount: string | null;
    unit: string | null;
    preparation: string | null;
  }>(
    `select ri.amount, ri.unit, ri.preparation
     from public.recipe_ingredients ri
     join public.ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id = $1 and i.name = 'salt'`,
    [recipeId],
  );
  expect(rows[0]).toEqual({
    amount: null,
    unit: null,
    preparation: "to taste",
  });
});

test("sections keep their lines together, in written order", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const { rows } = await db.query<{ section: string; name: string }>(
    `select ri.section, i.name
     from public.recipe_ingredients ri
     join public.ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id = $1
     order by ri.display_order`,
    [recipeId],
  );
  expect(rows.map((r) => r.section)).toEqual([
    "For the pasta",
    "For the pasta",
    "For the pasta",
    "For the sauce",
    "For the sauce",
    "For the sauce",
  ]);
});

test("two lines cannot claim the same position", async () => {
  const recipeId = await recipeIdBySlug(db, "test-pasta");
  const [oil] = await ingredientIds(db, ["olive oil"]);
  await expect(
    db.query(
      "insert into public.recipe_ingredients (recipe_id, ingredient_id, display_order) values ($1, $2, 1)",
      [recipeId, oil],
    ),
  ).rejects.toThrow(/duplicate key|unique/i);
});

test("cocktail lines are unchanged: one section, one line per bottle", async () => {
  const recipeId = await recipeIdBySlug(db, "daiquiri");
  const { rows } = await db.query<{ name: string; section: string | null }>(
    `select i.name, ri.section
     from public.recipe_ingredients ri
     join public.ingredients i on i.id = ri.ingredient_id
     where ri.recipe_id = $1
     order by ri.display_order`,
    [recipeId],
  );
  expect(rows).toEqual([
    { name: "white rum", section: null },
    { name: "lime juice", section: null },
    { name: "simple syrup", section: null },
    { name: "lime wheel", section: null },
  ]);
});

test("units fold to the controlled vocabulary, unknown ones survive", () => {
  expect(normalizeUnit("Tablespoons")).toBe("tbsp");
  expect(normalizeUnit("tsp.")).toBe("tsp");
  expect(normalizeUnit("  Fluid Ounces ")).toBe("oz");
  expect(normalizeUnit("grams")).toBe("g");
  expect(normalizeUnit("large")).toBe("each");
  expect(normalizeUnit("")).toBeNull();
  expect(normalizeUnit(null)).toBeNull();

  // The intentional fallback: kept as written, and flagged as off-vocabulary.
  expect(normalizeUnit("Handful")).toBe("handful");
  expect(isKnownUnit("handful")).toBe(false);
  expect(isKnownUnit("tbsp")).toBe(true);
});
