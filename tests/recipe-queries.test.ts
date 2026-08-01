// The application query layer (expansion phase 2). These assert the shape of
// the request sent to PostgREST — specifically that domain filtering is a
// database predicate on every listing, never a filter applied after the rows
// arrive (docs/expansion-plan.md §10.1).

import { expect, test } from "vitest";

import {
  EMPTY_FILTERS,
  getPublishedRecipeSlugs,
  getRecipeBySlug,
  getRecipeFacets,
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

const domainPredicates = (calls: Call[]) =>
  calls.filter((c) => c.method === "eq" && c.args[0] === "domain");

test("a single-domain listing filters in the database", async () => {
  const { client, calls } = fakeClient();
  await getRecipes(client, { domain: "food" });

  expect(calls[0]).toEqual({ method: "from", args: ["recipes"] });
  expect(domainPredicates(calls)).toEqual([
    { method: "eq", args: ["domain", "food"] },
  ]);
  // Publication is still enforced alongside it.
  expect(calls).toContainEqual({
    method: "eq",
    args: ["is_published", true],
  });
});

test("an all-domain listing adds no domain predicate", async () => {
  const { client, calls } = fakeClient();
  await getRecipes(client, { domain: "all" });
  expect(domainPredicates(calls)).toEqual([]);
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

test("facet options are scoped to the same domain as the listing", async () => {
  const { client, calls } = fakeClient();
  await getRecipeFacets(client, "food");
  expect(domainPredicates(calls)).toEqual([
    { method: "eq", args: ["domain", "food"] },
  ]);
});

test("fetching recipes by id can be scoped to a domain", async () => {
  const { client, calls } = fakeClient();
  await getRecipesByIds(client, [1, 2, 3], "cocktail");
  expect(calls).toContainEqual({ method: "in", args: ["id", [1, 2, 3]] });
  expect(domainPredicates(calls)).toEqual([
    { method: "eq", args: ["domain", "cocktail"] },
  ]);
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
  expect(domainPredicates(calls)).toEqual([
    { method: "eq", args: ["domain", "food"] },
  ]);
});

test("a recipe fetched by slug is not domain-filtered", async () => {
  // Slugs are unique across the whole catalog; the row reports its own domain
  // and the detail page composes itself from that.
  const { client, calls } = fakeClient();
  await getRecipeBySlug(client, "daiquiri");
  expect(domainPredicates(calls)).toEqual([]);
  expect(calls).toContainEqual({ method: "eq", args: ["slug", "daiquiri"] });
  const select = calls.find((c) => c.method === "select");
  expect(String(select?.args[0])).toContain("domain");
});
