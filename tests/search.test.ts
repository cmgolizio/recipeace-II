// Cross-domain search (expansion phase 14): one search over the whole
// catalog, narrowable to a domain, matching names, descriptions and the
// ingredients a recipe calls for.

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, seedFoodCatalog } from "./db";

type Hit = {
  slug: string;
  name: string;
  domain: string;
  matched: string;
  metadata: Record<string, string | number>;
};

let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodCatalog(db);
});

afterAll(async () => {
  await db.close();
});

async function search(q: string, domain?: "cocktail" | "food"): Promise<Hit[]> {
  const { rows } = await db.query<Hit>(
    `select slug, name, domain, matched, metadata
     from public.search_recipes($1, $2::public.recipe_domain, 50)`,
    [q, domain ?? null],
  );
  return rows;
}

test("one search spans both domains", async () => {
  const hits = await search("lime");
  const domains = new Set(hits.map((h) => h.domain));
  expect(domains).toEqual(new Set(["cocktail", "food"]));
  expect(hits.map((h) => h.slug)).toContain("daiquiri");
  expect(hits.map((h) => h.slug)).toContain("black-bean-tacos");
});

test("a domain narrows it in the database", async () => {
  const food = await search("lime", "food");
  expect(food.every((h) => h.domain === "food")).toBe(true);
  expect(food.map((h) => h.slug)).toContain("black-bean-tacos");
  expect(food.map((h) => h.slug)).not.toContain("daiquiri");

  const bar = await search("lime", "cocktail");
  expect(bar.every((h) => h.domain === "cocktail")).toBe(true);
});

test("a recipe is found by an ingredient it calls for", async () => {
  const hits = await search("lentil");
  const soup = hits.find((h) => h.slug === "lentil-soup");
  expect(soup).toBeDefined();
  // Its own name matches too, which is what a name hit looks like.
  expect(soup!.matched).toBe("name");

  // Dijon appears in the vinaigrette's ingredient list and nowhere in its
  // name or description, so this can only be an ingredient hit.
  const byIngredient = await search("dijon");
  expect(byIngredient.map((h) => h.slug)).toEqual(["lemon-vinaigrette"]);
  expect(byIngredient[0].matched).toBe("ingredient");
});

test("an alias finds the recipe its canonical ingredient is in", async () => {
  // "scallions" is an alias of green onion, which only the fried rice uses.
  const hits = await search("scallions");
  expect(hits.map((h) => h.slug)).toEqual(["chicken-fried-rice"]);
  expect(hits[0].matched).toBe("ingredient");
});

test("name hits outrank description and ingredient hits", async () => {
  const hits = await search("tomato");
  const ranks = hits.map((h) => h.matched);
  const firstIngredient = ranks.indexOf("ingredient");
  const lastName = ranks.lastIndexOf("name");
  if (firstIngredient !== -1 && lastName !== -1) {
    expect(lastName).toBeLessThan(firstIngredient);
  }
  expect(hits[0].slug).toBe("cucumber-tomato-salad");
});

test("results carry the domain-shaped card metadata", async () => {
  const [hit] = await search("negroni");
  expect(hit.domain).toBe("cocktail");
  expect(hit.metadata).toEqual({ method: "stirred", glass: "rocks" });

  const [dish] = await search("lentil soup");
  expect(dish.metadata).toMatchObject({ course: "soup" });
});

test("unpublished recipes never surface", async () => {
  await db.exec(
    "update public.recipes set is_published = false where slug = 'lentil-soup'",
  );
  try {
    expect(await search("lentil soup")).toEqual([]);
  } finally {
    await db.exec(
      "update public.recipes set is_published = true where slug = 'lentil-soup'",
    );
  }
});

test("an empty term returns nothing rather than everything", async () => {
  expect(await search("")).toEqual([]);
  expect(await search("   ")).toEqual([]);
});
