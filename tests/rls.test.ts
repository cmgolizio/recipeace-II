// Row Level Security, exercised rather than assumed (expansion phase 16,
// plan §41 "Security review"). The migrations create the policies; Supabase
// itself issues the table grants, so the grants are reproduced here and every
// query then runs as the `anon` role — the role an unauthenticated browser
// uses against PostgREST.
//
// Caveat, recorded honestly: PGlite is not the Supabase platform. auth.uid()
// is a shim and the API roles are approximations, so this proves the policies
// are written and enforced, not that the deployed project is configured
// correctly. That check belongs to the rollout (docs/expansion-rollout.md).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { createSeededDb, seedFoodCatalog } from "./db";

let db: PGlite;

/** Run a query as the anonymous API role, the way an unauthenticated visitor does. */
async function asAnon<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("set role anon");
  try {
    const { rows } = await db.query<T>(sql, params);
    return rows;
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = await createSeededDb();
  await seedFoodCatalog(db);
  // What Supabase grants out of the box; the migrations assume it.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant select on all tables in schema public to anon, authenticated;
    insert into public.recipes (slug, name, domain, is_published)
    values ('test-unpublished-dish', 'Unpublished Dish', 'food', false);
    insert into public.food_recipe_details (recipe_id, servings, course)
    select id, 2, 'main' from public.recipes where slug = 'test-unpublished-dish';
    insert into public.recipe_ingredients (recipe_id, ingredient_id, display_order)
    select r.id, i.id, 1 from public.recipes r, public.ingredients i
    where r.slug = 'test-unpublished-dish' and i.name = 'olive oil';
  `);
});

afterAll(async () => {
  await db.close();
});

test("an anonymous visitor sees published recipes and no others", async () => {
  const rows = await asAnon<{ slug: string }>(
    "select slug from public.recipes where slug like 'test-unpublished%' or slug = 'daiquiri'",
  );
  expect(rows.map((r) => r.slug)).toEqual(["daiquiri"]);
});

test("an unpublished recipe leaks nothing through its detail row", async () => {
  const details = await asAnon<{ recipe_id: number }>(
    "select recipe_id from public.food_recipe_details",
  );
  const unpublished = await db.query<{ id: number }>(
    "select id::int as id from public.recipes where slug = 'test-unpublished-dish'",
  );
  expect(details.map((d) => Number(d.recipe_id))).not.toContain(
    unpublished.rows[0].id,
  );
});

test("an unpublished recipe leaks nothing through its ingredient lines", async () => {
  const rows = await asAnon<{ count: number }>(
    `select count(*)::int as count
     from public.recipe_ingredients ri
     join public.recipes r on r.id = ri.recipe_id
     where r.slug = 'test-unpublished-dish'`,
  );
  expect(rows[0].count).toBe(0);
});

test("the catalog views inherit the base tables' RLS", async () => {
  // security_invoker = on is what makes this true; without it the views would
  // run as their owner and hand out unpublished rows.
  for (const view of ["cocktail_recipes", "food_recipes"] as const) {
    const rows = await asAnon<{ slug: string }>(
      `select slug from public.${view} where slug = 'test-unpublished-dish'`,
    );
    expect(rows).toEqual([]);
  }
});

test("search never returns an unpublished recipe", async () => {
  const rows = await asAnon<{ slug: string }>(
    "select slug from public.search_recipes('unpublished')",
  );
  expect(rows).toEqual([]);
});

test("matching never returns an unpublished recipe", async () => {
  const oil = await db.query<{ id: number }>(
    "select id::int as id from public.ingredients where name = 'olive oil'",
  );
  const rows = await asAnon<{ slug: string }>(
    `select r.slug from public.match_recipes($1::bigint[], null) m
     join public.recipes r on r.id = m.recipe_id`,
    [[oil.rows[0].id]],
  );
  expect(rows.map((r) => r.slug)).not.toContain("test-unpublished-dish");
});

test("reference data stays world-readable", async () => {
  const rows = await asAnon<{ count: number }>(
    "select count(*)::int as count from public.ingredients",
  );
  expect(rows[0].count).toBeGreaterThan(100);
});

test("another user's pantry, favorites and profile are invisible", async () => {
  await db.exec(`
    insert into auth.users (id, email)
    values ('11111111-1111-1111-1111-111111111111', 'someone@example.com');
    insert into public.pantry_items (user_id, ingredient_id)
    select '11111111-1111-1111-1111-111111111111', id
    from public.ingredients where name = 'gin';
    insert into public.favorite_recipes (user_id, recipe_id)
    select '11111111-1111-1111-1111-111111111111', id
    from public.recipes where slug = 'daiquiri';
  `);

  // No JWT claim: auth.uid() is null, so every owner-only policy denies.
  for (const table of ["pantry_items", "favorite_recipes", "profiles"]) {
    const rows = await asAnon<{ count: number }>(
      `select count(*)::int as count from public.${table}`,
    );
    expect(rows[0].count).toBe(0);
  }
});

test("content tables are read-only to the API roles", async () => {
  // No write policies exist by design: the pipeline writes with the secret
  // key, which bypasses RLS entirely.
  await expect(
    asAnon(
      "insert into public.recipes (slug, name, domain) values ('anon-write', 'Nope', 'food')",
    ),
  ).rejects.toThrow(/permission denied|violates row-level security/i);

  await expect(
    asAnon("update public.ingredients set name = 'hacked' where name = 'gin'"),
  ).rejects.toThrow(/permission denied|violates row-level security/i);
});
