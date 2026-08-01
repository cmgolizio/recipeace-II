// The food ingestion adapter (expansion phase 8): validation, reporting,
// duplicate detection, domain assignment, and the idempotence of what it
// emits. Everything here is pure except the last test, which applies the
// generated SQL to a real (PGlite) database twice.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { formatReport, isClean } from "../scripts/pipeline/core/report";
import {
  emitSql,
  ingestCatalog,
} from "../scripts/pipeline/domains/food/ingest";
import { parseCatalog } from "../scripts/pipeline/domains/food/source";
import type {
  FoodCatalog,
  FoodSourceRecipe,
} from "../scripts/pipeline/domains/food/source";
import { createSeededDb } from "./db";

/** A minimal valid recipe, built only from ingredients the seed already has. */
function recipe(overrides: Partial<FoodSourceRecipe> = {}): FoodSourceRecipe {
  return {
    name: "Mint Lemonade",
    description: "Lemon, mint, sugar, water.",
    course: "drink",
    cuisine: "american",
    difficulty: "easy",
    prepMinutes: 5,
    cookMinutes: 0,
    servings: 2,
    instructions: [
      "Muddle the mint with the sugar.",
      "Add lemon juice and water, stir, and chill.",
    ],
    ingredients: [
      { name: "lemon juice", amount: 0.5, unit: "cup" },
      { name: "fresh mint", amount: 12, unit: "leaves" },
      { name: "sugar", amount: 2, unit: "tbsp" },
      { name: "water", amount: 2, unit: "cup" },
    ],
    source: { name: "original", license: "original" },
    ...overrides,
  };
}

const catalogOf = (...recipes: FoodSourceRecipe[]): FoodCatalog => ({ recipes });

test("a valid recipe is accepted, stamped food, and left unpublished", () => {
  const result = ingestCatalog(catalogOf(recipe()));

  expect(result.report.rejected).toEqual([]);
  expect(result.recipes).toHaveLength(1);
  const [stored] = result.recipes;
  expect(stored.domain).toBe("food");
  expect(stored.slug).toBe("mint-lemonade");
  // §34: reviewed content only — publication is an explicit editorial act.
  expect(stored.is_published).toBe(false);
  expect(result.report.accepted[0].published).toBe(false);
});

test("publishing is opt-in", () => {
  const result = ingestCatalog(catalogOf(recipe({ publish: true })));
  expect(result.recipes[0].is_published).toBe(true);
});

test("food metadata is carried through, and total time is derived", () => {
  const result = ingestCatalog(catalogOf(recipe()));
  const [stored] = result.recipes;
  if (stored.domain !== "food") throw new Error("expected a food recipe");
  expect(stored.food).toEqual({
    prep_minutes: 5,
    cook_minutes: 0,
    total_minutes: 5,
    servings: 2,
    course: "drink",
    cuisine: "american",
  });
});

test("units fold to the vocabulary and sections survive", () => {
  const result = ingestCatalog(
    catalogOf(
      recipe({
        ingredients: [
          { name: "lemon juice", amount: 2, unit: "Tablespoons", section: "For the syrup" },
          { name: "sugar", amount: 2, unit: "tbsp", section: "For the syrup" },
          { name: "fresh mint", amount: 12, unit: "leaves", section: "To finish" },
          { name: "water", amount: 2, unit: "cup", section: "To finish" },
        ],
      }),
    ),
  );
  const lines = result.recipes[0].ingredients;
  expect(lines[0].unit).toBe("tbsp");
  expect(lines.map((l) => l.section)).toEqual([
    "For the syrup",
    "For the syrup",
    "To finish",
    "To finish",
  ]);
});

test("a repeated ingredient is kept — food says 'divided'", () => {
  const result = ingestCatalog(
    catalogOf(
      recipe({
        ingredients: [
          { name: "lemon juice", amount: 1, unit: "tbsp", preparation: "divided" },
          { name: "lemon juice", amount: 1, unit: "tbsp", preparation: "divided" },
          { name: "sugar", amount: 2, unit: "tbsp" },
          { name: "water", amount: 2, unit: "cup" },
        ],
      }),
    ),
  );
  expect(result.report.rejected).toEqual([]);
  expect(result.recipes[0].ingredients).toHaveLength(4);
  expect(result.recipes[0].ingredients.map((l) => l.display_order)).toEqual([
    1, 2, 3, 4,
  ]);
});

test("an unresolvable ingredient stops the recipe and is reported by name", () => {
  const result = ingestCatalog(
    catalogOf(
      recipe({
        ingredients: [
          ...recipe().ingredients,
          { name: "sous-vide unicorn", amount: 1, unit: "each" },
        ],
      }),
    ),
  );

  expect(result.recipes).toEqual([]);
  expect(result.report.unresolved).toEqual(["sous-vide unicorn"]);
  expect(result.report.rejected[0].reason).toMatch(/taxonomy doesn't have/);
  expect(isClean(result.report)).toBe(false);
});

test("an ingredient the catalog introduces resolves, and is listed as new", () => {
  const result = ingestCatalog({
    ingredients: [{ name: "rolled oats", category: "grain" }],
    aliases: [{ alias: "porridge oats", ingredient: "rolled oats" }],
    recipes: [
      recipe({
        name: "Overnight Oats",
        instructions: ["Stir the oats into the milk.", "Chill overnight."],
        ingredients: [
          { name: "porridge oats", amount: 1, unit: "cup" },
          { name: "milk", amount: 1, unit: "cup" },
        ],
      }),
    ],
  });

  expect(result.report.rejected).toEqual([]);
  expect(result.report.catalog.proposedIngredients).toEqual([
    "rolled oats (grain)",
  ]);
  expect(result.report.catalog.proposedAliases).toEqual([
    "porridge oats → rolled oats",
  ]);
});

test.each([
  ["no instructions", { instructions: [] }, /no instructions/],
  ["no servings", { servings: undefined }, /servings/],
  ["a negative time", { prepMinutes: -5 }, /non-negative/],
  [
    "a total shorter than its parts",
    { prepMinutes: 10, cookMinutes: 30, totalMinutes: 15 },
    /less than prep/,
  ],
  ["no licence", { source: { name: "somewhere" } }, /source name or licence/],
  [
    "one ingredient",
    { ingredients: [{ name: "sugar", amount: 1, unit: "tbsp" }] },
    /fewer than 2/,
  ],
  [
    "a non-positive amount",
    {
      ingredients: [
        { name: "sugar", amount: 0, unit: "tbsp" },
        { name: "water", amount: 1, unit: "cup" },
      ],
    },
    /non-positive/,
  ],
] as [string, Partial<FoodSourceRecipe>, RegExp][])(
  "a recipe with %s is rejected before insertion",
  (_label, overrides, reason) => {
    const result = ingestCatalog(
      catalogOf(recipe(overrides as Partial<FoodSourceRecipe>)),
    );
    expect(result.recipes).toEqual([]);
    expect(result.report.rejected[0].reason).toMatch(reason);
  },
);

test("an off-vocabulary unit is a warning, not a rejection", () => {
  const result = ingestCatalog(
    catalogOf(
      recipe({
        ingredients: [
          { name: "fresh mint", amount: 1, unit: "handful" },
          ...recipe().ingredients.slice(1),
        ],
      }),
    ),
  );
  expect(result.report.rejected).toEqual([]);
  expect(result.report.accepted[0].warnings.join(" ")).toMatch(
    /outside the vocabulary/,
  );
});

test("duplicates are caught, within the batch and against what exists", () => {
  const twice = ingestCatalog(catalogOf(recipe(), recipe()));
  expect(twice.recipes).toHaveLength(1);
  expect(twice.report.duplicates[0]).toMatch(/already taken|duplicate/i);

  const clash = ingestCatalog(catalogOf(recipe()), {
    existingSlugs: ["mint-lemonade"],
  });
  expect(clash.recipes).toEqual([]);

  const nearly = ingestCatalog(catalogOf(recipe({ slug: "mint-lemonade-2" })), {
    existingNames: ["mint lemonade"],
  });
  expect(nearly.recipes).toEqual([]);
  expect(nearly.report.duplicates[0]).toMatch(/looks like a duplicate/);
});

test("the dry-run report shows everything a reviewer needs", () => {
  const result = ingestCatalog({
    ingredients: [{ name: "rolled oats", category: "grain" }],
    aliases: [{ alias: "porridge oats", ingredient: "rolled oats" }],
    recipes: [recipe(), recipe({ name: "Broken", instructions: [] })],
  });
  const text = formatReport(result.report);

  expect(text).toContain("Mint Lemonade");
  expect(text).toContain("unpublished (awaiting review)");
  expect(text).toContain("0.5 cup lemon juice");
  expect(text).toContain("Rejected");
  expect(text).toContain("New canonical ingredients");
  expect(text).toContain("rolled oats (grain)");
  expect(text).toContain("New aliases");
  expect(text).toContain("Database operations");
  expect(text).toContain("domain = 'food'");
});

test("a malformed catalog fails as a file, not as a hundred recipes", () => {
  expect(() => parseCatalog(null)).toThrow(/must be a JSON object/);
  expect(() => parseCatalog({})).toThrow(/recipes must be an array/);
  expect(() => parseCatalog({ recipes: [], aliases: {} })).toThrow(
    /aliases must be an array/,
  );
});

// ── The emitted SQL, against a real database ────────────────────────────────

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

const CATALOG: FoodCatalog = {
  ingredients: [{ name: "rolled oats", category: "grain" }],
  aliases: [{ alias: "porridge oats", ingredient: "rolled oats" }],
  recipes: [
    recipe({ publish: true }),
    recipe({
      name: "Overnight Oats",
      instructions: ["Stir the oats into the milk.", "Chill overnight."],
      ingredients: [
        { name: "porridge oats", amount: 1, unit: "cup" },
        { name: "milk", amount: 1, unit: "cup" },
      ],
      publish: true,
    }),
  ],
};

test("the emitted SQL applies, and applying it twice changes nothing", async () => {
  const result = ingestCatalog(CATALOG);
  expect(isClean(result.report)).toBe(true);
  const sql = emitSql(CATALOG, result);

  await db.exec(sql);
  const snapshot = async () => {
    const { rows } = await db.query<Record<string, unknown>>(`
      select r.slug, r.domain, r.is_published, r.source, r.license,
             d.servings, d.total_minutes, d.course,
             (select count(*)::int from public.recipe_ingredients ri
              where ri.recipe_id = r.id) as lines
      from public.recipes r
      join public.food_recipe_details d on d.recipe_id = r.id
      order by r.slug
    `);
    return rows;
  };
  const first = await snapshot();
  expect(first).toHaveLength(2);
  expect(first[0]).toMatchObject({
    slug: "mint-lemonade",
    domain: "food",
    is_published: true,
    source: "original",
    license: "original",
    servings: 2,
    total_minutes: 5,
    course: "drink",
    lines: 4,
  });

  await db.exec(sql);
  expect(await snapshot()).toEqual(first);

  // The new canonical ingredient and its alias landed exactly once.
  const { rows: oats } = await db.query<{ count: number }>(
    "select count(*)::int as count from public.ingredients where name = 'rolled oats'",
  );
  expect(oats[0].count).toBe(1);
  const { rows: alias } = await db.query<{ count: number }>(
    "select count(*)::int as count from public.ingredient_aliases where alias = 'porridge oats'",
  );
  expect(alias[0].count).toBe(1);
});

test("food ingestion cannot overwrite a drink that shares its slug", async () => {
  const collide: FoodCatalog = {
    recipes: [recipe({ name: "Daiquiri", slug: "daiquiri", publish: true })],
  };
  const result = ingestCatalog(collide);
  // Nothing in the source file reveals the clash — the guard is in the SQL.
  expect(result.recipes).toHaveLength(1);

  await expect(db.exec(emitSql(collide, result))).rejects.toThrow(
    /already used by another domain/,
  );
  const { rows } = await db.query<{ domain: string; name: string }>(
    "select domain, name from public.recipes where slug = 'daiquiri'",
  );
  expect(rows[0]).toEqual({ domain: "cocktail", name: "Daiquiri" });
});
