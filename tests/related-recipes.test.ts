// related_recipes tests (polish-plan2 phase 7): the "More like this" ranking,
// against the real migration and seed data (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, recipeIdBySlug } from "./db";

type RelatedRow = {
  slug: string;
  name: string;
  method: string | null;
  glass: string | null;
  shared_count: number;
};

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

async function relatedTo(
  slug: string,
  maxResults?: number,
): Promise<RelatedRow[]> {
  const recipeId = await recipeIdBySlug(db, slug);
  const call =
    maxResults === undefined
      ? "public.related_recipes($1::bigint)"
      : "public.related_recipes($1::bigint, $2::int)";
  const { rows } = await db.query<RelatedRow>(
    `select slug, name, method, glass, shared_count::int as shared_count
     from ${call}`,
    maxResults === undefined ? [recipeId] : [recipeId, maxResults],
  );
  return rows;
}

test("ranks by shared ingredient count, ignoring garnish lines", async () => {
  // Old Fashioned: bourbon, simple syrup, angostura bitters (+ orange twist,
  // a garnish line). Whiskey Sour shares bourbon and simple syrup — its own
  // angostura line is flagged is_garnish, so it doesn't count a third time.
  const related = await relatedTo("old-fashioned");

  expect(related[0].slug).toBe("whiskey-sour");
  expect(related[0].shared_count).toBe(2);
  expect(related[0].method).toBe("shaken");
  expect(related[0].glass).toBe("rocks");
  // The subject never appears in its own related list.
  expect(related.some((r) => r.slug === "old-fashioned")).toBe(false);
  // Everything returned shares something.
  for (const r of related) expect(r.shared_count).toBeGreaterThan(0);
});

test("recipes sharing nothing are left out; ties break alphabetically", async () => {
  // Negroni: gin, campari, sweet vermouth. Gin & Tonic shares gin, Manhattan
  // shares sweet vermouth; nothing else overlaps at all.
  const related = await relatedTo("negroni");

  expect(related.map((r) => r.slug)).toEqual(["gin-and-tonic", "manhattan"]);
  expect(related.every((r) => r.shared_count === 1)).toBe(true);
});

test("max_results caps the row count", async () => {
  expect(await relatedTo("old-fashioned", 1)).toHaveLength(1);
});

test("a matching base_spirit outranks an equal-scoring recipe without one", async () => {
  // Both tie at one shared ingredient with the Negroni; giving Manhattan the
  // subject's base spirit has to lift it above the alphabetically-first tie.
  await db.exec(`
    update public.cocktail_recipe_details set base_spirit = 'gin'
    where recipe_id in (
      select id from public.recipes where slug in ('negroni', 'manhattan')
    );
  `);
  try {
    const related = await relatedTo("negroni");
    expect(related.map((r) => r.slug)).toEqual(["manhattan", "gin-and-tonic"]);
  } finally {
    await db.exec(
      `update public.cocktail_recipe_details set base_spirit = null
       where recipe_id in (
         select id from public.recipes where slug in ('negroni', 'manhattan')
       )`,
    );
  }
});

test("unpublished recipes are excluded", async () => {
  await db.exec(
    "update public.recipes set is_published = false where slug = 'whiskey-sour'",
  );
  try {
    const related = await relatedTo("old-fashioned");
    expect(related.some((r) => r.slug === "whiskey-sour")).toBe(false);
  } finally {
    await db.exec(
      "update public.recipes set is_published = true where slug = 'whiskey-sour'",
    );
  }
});