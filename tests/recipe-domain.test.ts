// Recipe domain (expansion phase 1): the constraint that every recipe carries
// exactly one valid domain, enforced by the database rather than by convention.
// Runs against the real migrations + seeds via PGlite (see tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb } from "./db";
import { validateRecipe, type GeneratedRecipe } from "../scripts/pipeline/domains/cocktail/validate";

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

/** Insert a throwaway recipe and clean it up, returning what the DB stored. */
async function withRecipe<T>(
  columns: string,
  values: string,
  fn: (slug: string) => Promise<T>,
): Promise<T> {
  const slug = `test-domain-${Math.random().toString(36).slice(2, 10)}`;
  await db.query(
    `insert into public.recipes (slug, name, ${columns}) values ($1, 'Domain Fixture', ${values})`,
    [slug],
  );
  try {
    return await fn(slug);
  } finally {
    await db.exec(`delete from public.recipes where slug = '${slug}'`);
  }
}

test("every seeded recipe is backfilled as a cocktail", async () => {
  const { rows } = await db.query<{ domain: string; count: number }>(
    "select domain, count(*)::int as count from public.recipes group by domain",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].domain).toBe("cocktail");
  expect(rows[0].count).toBeGreaterThan(0);
});

test("no recipe can exist without a domain", async () => {
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from public.recipes where domain is null",
  );
  expect(rows[0].count).toBe(0);
});

test("cocktail and food are both accepted", async () => {
  for (const domain of ["cocktail", "food"] as const) {
    const stored = await withRecipe("domain", `'${domain}'`, async (slug) => {
      const { rows } = await db.query<{ domain: string }>(
        "select domain from public.recipes where slug = $1",
        [slug],
      );
      return rows[0].domain;
    });
    expect(stored).toBe(domain);
  }
});

test("an invalid domain is rejected", async () => {
  await expect(
    withRecipe("domain", "'dessert'", async () => undefined),
  ).rejects.toThrow(/invalid input value for enum|dessert/i);
});

test("a null domain is rejected", async () => {
  await expect(
    withRecipe("domain", "null", async () => undefined),
  ).rejects.toThrow(/not-null|null value/i);
});

test("the column has no default, so an omitted domain fails", async () => {
  // The guard against a food recipe being silently filed as a cocktail.
  await expect(
    withRecipe("is_published", "true", async () => undefined),
  ).rejects.toThrow(/not-null|null value/i);
});

test("food and cocktail recipes coexist in one table", async () => {
  await withRecipe("domain", "'food'", async () => {
    const { rows } = await db.query<{ domain: string; count: number }>(
      "select domain, count(*)::int as count from public.recipes group by domain order by domain",
    );
    expect(rows.map((r) => r.domain)).toEqual(["cocktail", "food"]);
  });
});

test("the cocktail pipeline stamps its recipes as cocktails", async () => {
  const generated: GeneratedRecipe = {
    name: "Domain Test Sour",
    instructions: ["Shake.", "Strain."],
    ingredients: [
      { name: "gin", amount: 2, unit: "oz" },
      { name: "lemon juice", amount: 0.75, unit: "oz" },
    ],
  };
  // Resolver stands in for the taxonomy: any name maps to a distinct id.
  const ids = new Map([["gin", 1], ["lemon juice", 2]]);
  const result = validateRecipe(generated, (name) => ids.get(name) ?? null);

  expect(result.status).toBe("ok");
  if (result.status !== "ok") return;
  expect(result.recipe.domain).toBe("cocktail");
});