// Matcher tests: exercise the real match_recipes / recipe_pantry_status SQL
// functions against the real migrations and seed data (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, ingredientIds, recipeIdBySlug } from "./db";

type MatchRow = {
  slug: string;
  required_count: number;
  exact_count: number;
  substitute_count: number;
  missing_count: number;
  missing_ingredients: string[];
};

type StatusRow = {
  name: string;
  status: string;
  substitute_with: string | null;
  derived_from: string | null;
};

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

/** match_recipes joined to slugs. `maxMissing` undefined = use the SQL default. */
async function matchRecipes(
  pantry: number[],
  maxMissing?: number | null,
): Promise<MatchRow[]> {
  const call =
    maxMissing === undefined
      ? "public.match_recipes($1::bigint[])"
      : "public.match_recipes($1::bigint[], $2::int)";
  const { rows } = await db.query<MatchRow>(
    `select r.slug, m.required_count, m.exact_count, m.substitute_count,
            m.missing_count, m.missing_ingredients
     from ${call} m
     join public.recipes r on r.id = m.recipe_id`,
    maxMissing === undefined ? [pantry] : [pantry, maxMissing],
  );
  return rows;
}

async function pantryStatus(
  recipeSlug: string,
  pantry: number[],
): Promise<StatusRow[]> {
  const recipeId = await recipeIdBySlug(db, recipeSlug);
  const { rows } = await db.query<StatusRow>(
    `select name, status, substitute_with, derived_from
     from public.recipe_pantry_status($1::bigint, $2::bigint[])`,
    [recipeId, pantry],
  );
  return rows;
}

test("derivation: owning orange satisfies orange twist as 'have' via orange", async () => {
  const pantry = await ingredientIds(db, ["orange"]);
  const rows = await pantryStatus("old-fashioned", pantry);

  const twist = rows.find((r) => r.name === "orange twist");
  expect(twist).toBeDefined();
  expect(twist!.status).toBe("have");
  expect(twist!.derived_from).toBe("orange");

  // The rest of the recipe is not granted by the fruit.
  const bourbon = rows.find((r) => r.name === "bourbon");
  expect(bourbon!.status).toBe("missing");
  expect(bourbon!.derived_from).toBeNull();
});

test("substitution: one bidirectional hop covers white rum via cachaça", async () => {
  // Daiquiri requires white rum, lime juice, simple syrup. Cachaça is listed
  // as a substitute OF white rum, so the hop here runs in reverse; lime juice
  // is exact via the lime derivation; simple syrup is owned directly.
  const pantry = await ingredientIds(db, ["cachaça", "lime", "simple syrup"]);
  const matches = await matchRecipes(pantry);

  const daiquiri = matches.find((m) => m.slug === "daiquiri");
  expect(daiquiri).toBeDefined();
  expect(daiquiri!.missing_count).toBe(0);
  expect(daiquiri!.exact_count).toBe(2);
  expect(daiquiri!.substitute_count).toBe(1);
  expect(daiquiri!.missing_ingredients).toEqual([]);
});

test("staples count as exact coverage in match_recipes", async () => {
  // No seeded recipe requires a staple, so use a fixture: a recipe needing
  // gin plus sugar (a staple). Owning only gin must fully cover it.
  await db.exec(`
    insert into public.recipes (slug, name, is_published)
    values ('test-staple-fixture', 'Staple Fixture', true);
    insert into public.recipe_ingredients (recipe_id, ingredient_id, display_order)
    select r.id, i.id, i.ord
    from public.recipes r,
         (select id, 1 as ord from public.ingredients where name = 'gin'
          union all
          select id, 2 from public.ingredients where name = 'sugar') i
    where r.slug = 'test-staple-fixture';
  `);
  try {
    const pantry = await ingredientIds(db, ["gin"]);
    const matches = await matchRecipes(pantry);

    const fixture = matches.find((m) => m.slug === "test-staple-fixture");
    expect(fixture).toBeDefined();
    expect(fixture!.required_count).toBe(2);
    expect(fixture!.exact_count).toBe(2);
    expect(fixture!.missing_count).toBe(0);
  } finally {
    // Cascades to recipe_ingredients; keeps later tests on pure seed data.
    await db.exec(
      "delete from public.recipes where slug = 'test-staple-fixture'",
    );
  }
});

test("zero-overlap recipes are excluded even with max_missing null", async () => {
  const pantry = await ingredientIds(db, ["campari"]);
  const matches = await matchRecipes(pantry, null);

  // Campari covers nothing of a daiquiri (white rum, lime juice, simple syrup).
  expect(matches.find((m) => m.slug === "daiquiri")).toBeUndefined();

  // But the negroni overlaps on campari, so it is returned with the rest named.
  const negroni = matches.find((m) => m.slug === "negroni");
  expect(negroni).toBeDefined();
  expect(negroni!.exact_count).toBe(1);
  expect(negroni!.missing_count).toBe(2);
  expect(negroni!.missing_ingredients).toEqual(["gin", "sweet vermouth"]);

  // The invariant holds for every returned row.
  for (const m of matches) {
    expect(m.exact_count + m.substitute_count).toBeGreaterThan(0);
  }
});

test("max_missing defaults to 2", async () => {
  const pantry = await ingredientIds(db, ["campari"]);
  const matches = await matchRecipes(pantry);

  expect(matches.length).toBeGreaterThan(0);
  for (const m of matches) {
    expect(m.missing_count).toBeLessThanOrEqual(2);
  }
});