// The application query layer (expansion phases 2 and 5). These assert the
// shape of the request sent to PostgREST — specifically that each surface
// reads its own domain's catalog, and that filtering happens in the database
// rather than after the rows arrive (docs/expansion-plan.md §10.1).

import { expect, test } from "vitest";

import {
  EMPTY_FILTERS,
  getCocktailFacets,
  getPublishedRecipeSlugs,
  getRecipeBySlug,
  getRecipes,
  getRecipesByIds,
  type RecipeClient,
} from "../src/lib/recipes/queries";

type Call = { method: string; args: unknown[] };

const CHAIN_METHODS = [
  "select",
  "eq",
  "in",
  "or",
  "contains",
  "order",
  "range",
] as const;

/**
 * A PostgREST builder stand-in: every chain method records its call and
 * returns the builder, and awaiting it resolves an empty result set.
 */
function fakeClient(): { client: RecipeClient; calls: Call[] } {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: [], count: 0, error: null })),
    maybeSingle: () => {
      calls.push({ method: "maybeSingle", args: [] });
      return Promise.resolve({ data: null, error: null });
    },
  };
  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client: client as unknown as RecipeClient, calls };
}

const sources = (calls: Call[]) =>
  calls.filter((c) => c.method === "from").map((c) => c.args[0]);

test("each domain's catalog is read from its own view", async () => {
  const bar = fakeClient();
  await getRecipes(bar.client, { domain: "cocktail" });
  expect(sources(bar.calls)).toEqual(["cocktail_recipes"]);

  const kitchen = fakeClient();
  await getRecipes(kitchen.client, { domain: "food" });
  expect(sources(kitchen.calls)).toEqual(["food_recipes"]);
});

test("only published recipes reach a catalog page", async () => {
  const { client, calls } = fakeClient();
  await getRecipes(client, { domain: "cocktail" });
  expect(calls).toContainEqual({ method: "eq", args: ["is_published", true] });
});

test("pagination is expressed as a range, one page at a time", async () => {
  const { client, calls } = fakeClient();
  await getRecipes(client, { domain: "cocktail", page: 3, pageSize: 24 });
  expect(calls).toContainEqual({ method: "range", args: [48, 71] });
});

test("a search term is escaped into the or= list", async () => {
  const { client, calls } = fakeClient();
  await getRecipes(client, {
    domain: "cocktail",
    filters: { ...EMPTY_FILTERS, q: 'gin"n\\juice' },
  });
  const or = calls.find((c) => c.method === "or");
  expect(or?.args[0]).toBe(
    'name.ilike."%gin\\"n\\\\juice%",description.ilike."%gin\\"n\\\\juice%"',
  );
});

test("drink facets are never applied to a food query", async () => {
  const filters = {
    ...EMPTY_FILTERS,
    method: "shaken",
    glass: "coupe",
    spirit: "gin",
    tags: ["citrusy"],
    sort: "strength" as const,
  };

  const bar = fakeClient();
  await getRecipes(bar.client, { domain: "cocktail", filters });
  expect(bar.calls).toContainEqual({ method: "eq", args: ["method", "shaken"] });
  expect(bar.calls).toContainEqual({
    method: "contains",
    args: ["flavor_tags", ["citrusy"]],
  });
  expect(bar.calls.some((c) => c.args[0] === "strength")).toBe(true);

  const kitchen = fakeClient();
  await getRecipes(kitchen.client, { domain: "food", filters });
  const columns = kitchen.calls.flatMap((c) => c.args.slice(0, 1));
  for (const drinkColumn of ["method", "glass", "base_spirit", "flavor_tags"]) {
    expect(columns).not.toContain(drinkColumn);
  }
});

test("a shared filter applies in either domain", async () => {
  for (const domain of ["cocktail", "food"] as const) {
    const { client, calls } = fakeClient();
    await getRecipes(client, {
      domain,
      filters: { ...EMPTY_FILTERS, difficulty: "easy" },
    });
    expect(calls).toContainEqual({
      method: "eq",
      args: ["difficulty", "easy"],
    });
  }
});

test("Bar facet options come from the cocktail catalog", async () => {
  const { client, calls } = fakeClient();
  await getCocktailFacets(client);
  expect(sources(calls)).toEqual(["cocktail_recipes"]);
  expect(calls).toContainEqual({ method: "eq", args: ["is_published", true] });
});

test("a mixed list of ids reads both catalogs, never the raw table", async () => {
  const { client, calls } = fakeClient();
  await getRecipesByIds(client, [1, 2, 3], "all");
  expect(sources(calls).sort()).toEqual(["cocktail_recipes", "food_recipes"]);
  expect(calls.filter((c) => c.method === "in")).toHaveLength(2);
});

test("a single-domain list of ids reads only that catalog", async () => {
  const { client, calls } = fakeClient();
  await getRecipesByIds(client, [1, 2, 3], "cocktail");
  expect(sources(calls)).toEqual(["cocktail_recipes"]);
  expect(calls).toContainEqual({ method: "in", args: ["id", [1, 2, 3]] });
});

test("an empty id list never reaches the database", async () => {
  const { client, calls } = fakeClient();
  const result = await getRecipesByIds(client, [], "all");
  expect(result).toEqual({ recipes: [], error: null });
  expect(calls).toEqual([]);
});

test("slug listings are domain-scoped", async () => {
  const { client, calls } = fakeClient();
  await getPublishedRecipeSlugs(client, "food");
  expect(calls).toContainEqual({ method: "eq", args: ["domain", "food"] });

  const all = fakeClient();
  await getPublishedRecipeSlugs(all.client, "all");
  expect(all.calls.some((c) => c.args[0] === "domain")).toBe(false);
});

test("a recipe fetched by slug is not domain-filtered", async () => {
  // Slugs are unique across the whole catalog; the row reports its own domain
  // and the detail page composes itself from that.
  const { client, calls } = fakeClient();
  await getRecipeBySlug(client, "daiquiri");
  expect(calls.some((c) => c.args[0] === "domain")).toBe(false);
  expect(calls).toContainEqual({ method: "eq", args: ["slug", "daiquiri"] });
  const select = calls.find((c) => c.method === "select");
  expect(String(select?.args[0])).toContain("domain");
});
