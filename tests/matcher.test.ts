// Matcher tests: exercise the real match_recipes / recipe_pantry_status SQL
// functions against the real migrations and seed data (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import {
  createSeededDb,
  ingredientIds,
  recipeIdBySlug,
  seedFoodFixture,
} from "./db";

type MatchRow = {
  slug: string;
  required_count: number;
  exact_count: number;
  substitute_count: number;
  missing_count: number;
  missing_ingredients: string[];
};

type Domain = "cocktail" | "food";

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

/**
 * match_recipes joined to slugs. `maxMissing` undefined = use the SQL default;
 * `domain` undefined = every domain (the SQL default).
 */
async function matchRecipes(
  pantry: number[],
  maxMissing?: number | null,
  domain?: Domain,
): Promise<MatchRow[]> {
  const call =
    maxMissing === undefined
      ? "public.match_recipes($1::bigint[])"
      : domain === undefined
        ? "public.match_recipes($1::bigint[], $2::int)"
        : "public.match_recipes($1::bigint[], $2::int, $3::public.recipe_domain)";
  const args =
    maxMissing === undefined
      ? [pantry]
      : domain === undefined
        ? [pantry, maxMissing]
        : [pantry, maxMissing, domain];
  const { rows } = await db.query<MatchRow>(
    `select r.slug, m.required_count, m.exact_count, m.substitute_count,
            m.missing_count, m.missing_ingredients
     from ${call} m
     join public.recipes r on r.id = m.recipe_id`,
    args,
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
    insert into public.recipes (slug, name, domain, is_published)
    values ('test-staple-fixture', 'Staple Fixture', 'cocktail', true);
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

type DetailRow = {
  recipe_id: number;
  slug: string;
  name: string;
  domain: Domain;
  metadata: { method?: string; glass?: string };
  missing_count: number;
  missing_ingredients: string[];
  ingredients: {
    name: string;
    amount: number | null;
    unit: string | null;
    is_optional: boolean;
  }[];
};

test("match_recipes_detail returns match_recipes rows in the same order, with card fields", async () => {
  const pantry = await ingredientIds(db, ["campari"]);

  const { rows: base } = await db.query<{ recipe_id: number }>(
    "select recipe_id::int as recipe_id from public.match_recipes($1::bigint[], null)",
    [pantry],
  );
  const { rows: detail } = await db.query<DetailRow>(
    `select recipe_id::int as recipe_id, slug, name, domain, metadata,
            missing_count, missing_ingredients, ingredients
     from public.match_recipes_detail($1::bigint[], null)`,
    [pantry],
  );

  expect(detail.map((r) => r.recipe_id)).toEqual(base.map((r) => r.recipe_id));

  const negroni = detail.find((r) => r.slug === "negroni");
  expect(negroni).toBeDefined();
  expect(negroni!.name).toBe("Negroni");
  expect(negroni!.domain).toBe("cocktail");
  // The card fields a cocktail contributes, and only those.
  expect(negroni!.metadata).toEqual({ method: "stirred", glass: "rocks" });
  expect(negroni!.missing_ingredients).toEqual(["gin", "sweet vermouth"]);
});

test("match_recipes_detail ingredients carry what the card renders, in display order", async () => {
  const pantry = await ingredientIds(db, ["cachaça", "lime", "simple syrup"]);
  const { rows } = await db.query<DetailRow>(
    "select slug, ingredients from public.match_recipes_detail($1::bigint[])",
    [pantry],
  );

  const daiquiri = rows.find((r) => r.slug === "daiquiri");
  expect(daiquiri).toBeDefined();
  // Full list (optional garnish included), ordered by display_order.
  expect(daiquiri!.ingredients.map((i) => i.name)).toEqual([
    "white rum",
    "lime juice",
    "simple syrup",
    "lime wheel",
  ]);
  const rum = daiquiri!.ingredients[0];
  expect(rum.amount).toBe(2);
  expect(rum.unit).toBe("oz");
  expect(rum.is_optional).toBe(false);
  expect(daiquiri!.ingredients[3].is_optional).toBe(true);
});
// ── Domain generalisation (expansion phase 3) ───────────────────────────────
//
// One engine, two domains. These lock in that the *only* thing the domain
// argument changes is which recipes are candidates — never how they score.

/** The seeded cocktail rankings, verbatim, as the regression baseline. */
const COCKTAIL_BASELINE: Record<string, string[]> = {
  "gin,sweet vermouth": ["gin-and-tonic", "negroni", "manhattan"],
  "white rum,lime juice,simple syrup": [
    "daiquiri",
    "whiskey-sour",
    "margarita",
    "old-fashioned",
    "mojito",
  ],
  "bourbon,lemon juice": [
    "whiskey-sour",
    "old-fashioned",
    "daiquiri",
    "margarita",
    "manhattan",
  ],
};

test("cocktail ranking is unchanged by the domain argument", async () => {
  await seedFoodFixture(db);
  for (const [names, expected] of Object.entries(COCKTAIL_BASELINE)) {
    const pantry = await ingredientIds(db, names.split(","));
    const scoped = await matchRecipes(pantry, 2, "cocktail");
    expect(scoped.map((m) => m.slug)).toEqual(expected);

    // Same rows, same order, with or without the argument — the food fixture
    // in the table cannot perturb a cocktail ranking.
    const unscoped = await matchRecipes(pantry, 2);
    expect(unscoped.filter((m) => expected.includes(m.slug))).toEqual(scoped);
  }
});

test("a food request never returns cocktails, and vice versa", async () => {
  await seedFoodFixture(db);
  // The sorbet and the daiquiri require exactly the same three ingredients.
  const pantry = await ingredientIds(db, [
    "white rum",
    "lime juice",
    "simple syrup",
  ]);

  const food = await matchRecipes(pantry, 0, "food");
  expect(food.map((m) => m.slug)).toEqual(["rum-lime-sorbet"]);
  expect(food[0].missing_count).toBe(0);

  const cocktails = await matchRecipes(pantry, 2, "cocktail");
  expect(cocktails.map((m) => m.slug)).toContain("daiquiri");
  expect(cocktails.map((m) => m.slug)).not.toContain("rum-lime-sorbet");

  // Both, when nothing narrows it.
  const all = await matchRecipes(pantry, 2);
  expect(all.map((m) => m.slug)).toContain("daiquiri");
  expect(all.map((m) => m.slug)).toContain("rum-lime-sorbet");
});

test("one pantry ingredient satisfies recipes in either domain", async () => {
  await seedFoodFixture(db);
  const pantry = await ingredientIds(db, ["lemon", "strawberry", "fresh basil"]);

  // lemon → lemon juice by derivation, in the food domain exactly as in the bar.
  const food = await matchRecipes(pantry, 0, "food");
  expect(food.map((m) => m.slug)).toEqual(["berry-basil-salad"]);

  const status = await pantryStatus("berry-basil-salad", pantry);
  const lemonJuice = status.find((r) => r.name === "lemon juice");
  expect(lemonJuice!.status).toBe("have");
  expect(lemonJuice!.derived_from).toBe("lemon");
});

test("optional food ingredients never raise the missing count", async () => {
  await seedFoodFixture(db);
  // The salad's basil line is optional; owning only cucumber + mint makes it.
  const pantry = await ingredientIds(db, ["cucumber", "fresh mint"]);
  const matches = await matchRecipes(pantry, 0, "food");

  const salad = matches.find((m) => m.slug === "cucumber-mint-salad");
  expect(salad).toBeDefined();
  expect(salad!.required_count).toBe(2);
  expect(salad!.missing_count).toBe(0);
  expect(salad!.missing_ingredients).toEqual([]);
});

test("staples are assumed in the kitchen the same way they are at the bar", async () => {
  // Documented policy (plan §11.4): the staple set is global and tiny. A food
  // recipe calling for salt gets it for free, exactly as a cocktail does.
  await db.exec(`
    insert into public.recipes (slug, name, domain, is_published)
    values ('test-food-staple', 'Salted Cucumber', 'food', true);
    insert into public.recipe_ingredients (recipe_id, ingredient_id, display_order)
    select r.id, i.id, i.ord
    from public.recipes r,
         (select id, 1 as ord from public.ingredients where name = 'cucumber'
          union all
          select id, 2 from public.ingredients where name = 'salt') i
    where r.slug = 'test-food-staple';
  `);
  try {
    const pantry = await ingredientIds(db, ["cucumber"]);
    const matches = await matchRecipes(pantry, 0, "food");
    const fixture = matches.find((m) => m.slug === "test-food-staple");
    expect(fixture).toBeDefined();
    expect(fixture!.required_count).toBe(2);
    expect(fixture!.exact_count).toBe(2);
    expect(fixture!.missing_count).toBe(0);
  } finally {
    await db.exec("delete from public.recipes where slug = 'test-food-staple'");
  }
});

test("match_recipes_detail carries the domain through and stays in step", async () => {
  await seedFoodFixture(db);
  const pantry = await ingredientIds(db, [
    "white rum",
    "lime juice",
    "simple syrup",
  ]);
  const { rows } = await db.query<DetailRow>(
    `select slug, domain, metadata
     from public.match_recipes_detail($1::bigint[], 2, 'food'::public.recipe_domain)`,
    [pantry],
  );

  // Same rows in the same order as the ranked matcher, food only.
  const ranked = await matchRecipes(pantry, 2, "food");
  expect(rows.map((r) => r.slug)).toEqual(ranked.map((m) => m.slug));
  expect(rows[0].slug).toBe("rum-lime-sorbet");
  expect(rows.every((r) => r.domain === "food")).toBe(true);
  // No drink fields on a food card.
  expect(rows[0].metadata).toEqual({});
});
