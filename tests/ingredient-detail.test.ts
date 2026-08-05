// Per-ingredient page tests (polish-plan2 phase 8): the slug column and the
// ingredient_detail RPC, against the real migrations and seed data (tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb } from "./db";

type Detail = {
  id: number;
  name: string;
  slug: string;
  category: string;
  is_staple: boolean;
  recipes: {
    slug: string;
    name: string;
    domain: string;
    image_url: string | null;
    metadata: Record<string, string | number>;
  }[];
  substitutes: { name: string; slug: string; note: string | null }[];
  derives: { name: string; slug: string }[];
};

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

async function detail(slug: string): Promise<Detail | undefined> {
  const { rows } = await db.query<Detail>(
    "select * from public.ingredient_detail($1)",
    [slug],
  );
  return rows[0];
}

test("slugify folds accents, drops apostrophes, and collapses separators", async () => {
  const { rows } = await db.query<{ slug: string; input: string }>(
    `select input, public.slugify(input) as slug
     from unnest($1::text[]) as input`,
    [["crème de mûre", "peychaud's bitters", "half-and-half", "  Añejo Tequila  "]],
  );
  expect(rows.map((r) => r.slug)).toEqual([
    "creme-de-mure",
    "peychauds-bitters",
    "half-and-half",
    "anejo-tequila",
  ]);
});

test("every seeded ingredient has the slug public.slugify would give it", async () => {
  // The seed emits slugs from the TypeScript slugify in
  // scripts/generate-seed-sql.ts; this is what keeps the two definitions
  // honest, including for ingredients added later.
  const { rows } = await db.query<{ name: string; slug: string }>(
    "select name, slug from public.ingredients where slug is distinct from public.slugify(name)",
  );
  expect(rows).toEqual([]);
});

test("slugs are unique across the taxonomy", async () => {
  const { rows } = await db.query<{ total: number; distinct_slugs: number }>(
    `select count(*)::int as total, count(distinct slug)::int as distinct_slugs
     from public.ingredients`,
  );
  expect(rows[0].total).toBeGreaterThan(0);
  expect(rows[0].distinct_slugs).toBe(rows[0].total);
});

test("returns the ingredient with the published recipes that use it", async () => {
  const limeJuice = await detail("lime-juice");

  expect(limeJuice?.name).toBe("lime juice");
  expect(limeJuice?.category).toBe("juice");
  expect(limeJuice?.is_staple).toBe(false);
  expect(limeJuice?.recipes.map((r) => r.slug)).toEqual([
    "cosmopolitan",
    "daiquiri",
    "margarita",
    "mojito",
  ]);
  // The card fields the /ingredients page renders through RecipeCard. The
  // listing spans both domains, so each recipe carries its domain and a
  // domain-shaped `metadata` object rather than bare method/glass keys.
  expect(limeJuice?.recipes[1]).toEqual({
    id: expect.any(Number),
    slug: "daiquiri",
    name: "Daiquiri",
    domain: "cocktail",
    metadata: { method: "shaken", glass: "coupe" },
    image_url: null,
  });
});

test("substitutes are read in both directions, with the note", async () => {
  // Seeded one way only: lemon juice → lime juice.
  const limeJuice = await detail("lime-juice");
  expect(limeJuice?.substitutes).toEqual([
    {
      name: "lemon juice",
      slug: "lemon-juice",
      note: "shifts the flavor profile; not identical",
    },
  ]);

  const lemonJuice = await detail("lemon-juice");
  expect(lemonJuice?.substitutes.map((s) => s.name)).toEqual(["lime juice"]);
});

test("derivations list what owning the ingredient yields, one-way", async () => {
  const lemon = await detail("lemon");
  expect(lemon?.derives.map((d) => d.slug)).toEqual([
    "lemon-juice",
    "lemon-twist",
    "lemon-wedge",
    "lemon-wheel",
  ]);
  // No recipe calls for a whole lemon, and nothing yields one.
  expect(lemon?.recipes).toEqual([]);

  const lemonTwist = await detail("lemon-twist");
  expect(lemonTwist?.derives).toEqual([]);
});

test("unpublished recipes are excluded", async () => {
  await db.exec(
    "update public.recipes set is_published = false where slug = 'daiquiri'",
  );
  try {
    const limeJuice = await detail("lime-juice");
    expect(limeJuice?.recipes.some((r) => r.slug === "daiquiri")).toBe(false);
  } finally {
    await db.exec(
      "update public.recipes set is_published = true where slug = 'daiquiri'",
    );
  }
});

test("an unknown slug returns no rows", async () => {
  expect(await detail("no-such-ingredient")).toBeUndefined();
});