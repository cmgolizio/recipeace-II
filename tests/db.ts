// Test database: in-process Postgres (PGlite) loaded with the real schema —
// the actual files from supabase/migrations in order, then supabase/seed.sql
// (ingredient taxonomy) and supabase/seed_test_recipes.sql (recipes) — exactly
// what a local `supabase db reset` produces. A small shim stands in for the
// primitives the Supabase platform provides outside the migrations: the auth
// schema, the API roles, and the extensions schema.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const SUPABASE_SHIM = `
create schema extensions;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
`;

export async function createSeededDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_SHIM);

  const supabaseDir = path.join(process.cwd(), "supabase");
  const migrationsDir = path.join(supabaseDir, "migrations");
  const migrations = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
  }

  for (const seed of ["seed.sql", "seed_test_recipes.sql"]) {
    await db.exec(await readFile(path.join(supabaseDir, seed), "utf8"));
  }

  return db;
}

/**
 * The real curated food catalog (src/data/food-seed.ts, compiled to
 * supabase/seed_food.sql by `npm run pipeline:food`). Loaded only by the
 * suites that are about food data, so the cocktail suites keep asserting
 * against a small, stable fixture set.
 */
export async function seedFoodCatalog(db: PGlite): Promise<void> {
  const file = path.join(process.cwd(), "supabase", "seed_food.sql");
  await db.exec(await readFile(file, "utf8"));
}

/**
 * A few food recipes for the domain tests, built entirely from ingredients
 * seed.sql already carries — the point of the expansion is that food and
 * cocktails share one catalog, so the fixture must not invent a second one.
 *
 * `rum-lime-sorbet` deliberately has the same required ingredient set as the
 * seeded daiquiri: the only thing separating them is the domain.
 */
export async function seedFoodFixture(db: PGlite): Promise<void> {
  await db.exec(`
    insert into public.recipes (slug, name, domain, instructions, description, is_published) values
    ('berry-basil-salad','Berry Basil Salad','food',
      array['Hull and halve the strawberries.','Tear the basil over the top.','Dress with lemon juice and sugar.'],
      'Strawberries, basil, lemon.', true),
    ('cucumber-mint-salad','Cucumber Mint Salad','food',
      array['Slice the cucumber thin.','Toss with torn mint.'],
      'Cool, crunchy, five minutes.', true),
    ('rum-lime-sorbet','Rum Lime Sorbet','food',
      array['Stir the syrup and lime juice together.','Add the rum.','Churn until set.'],
      'The daiquiri, frozen — same ingredients, different domain.', true)
    on conflict (slug) do nothing;

    insert into public.recipe_ingredients
      (recipe_id, ingredient_id, amount, unit, is_optional, is_garnish, display_order)
    select r.id, i.id, v.amount::numeric, v.unit::text,
           v.is_optional::boolean, false, v.display_order::int
    from (values
      ('berry-basil-salad','strawberry',2.0,'cup',false,1),
      ('berry-basil-salad','fresh basil',6.0,'leaves',false,2),
      ('berry-basil-salad','lemon juice',1.0,'tsp',false,3),

      ('cucumber-mint-salad','cucumber',1.0,'each',false,1),
      ('cucumber-mint-salad','fresh mint',6.0,'leaves',false,2),
      ('cucumber-mint-salad','fresh basil',2.0,'leaves',true,3),

      ('rum-lime-sorbet','white rum',2.0,'oz',false,1),
      ('rum-lime-sorbet','lime juice',1.0,'oz',false,2),
      ('rum-lime-sorbet','simple syrup',0.75,'oz',false,3)
    ) as v(recipe_slug, ingredient_name, amount, unit, is_optional, display_order)
    join public.recipes r on r.slug = v.recipe_slug
    join public.ingredients i on i.name = v.ingredient_name
    on conflict (recipe_id, display_order) do nothing;
  `);
}

/** Resolve ingredient names to ids, in the given order. Throws on a miss. */
export async function ingredientIds(
  db: PGlite,
  names: string[],
): Promise<number[]> {
  const { rows } = await db.query<{ id: number; name: string }>(
    "select id::int as id, name from public.ingredients where name = any($1::text[])",
    [names],
  );
  return names.map((name) => {
    const row = rows.find((r) => r.name === name);
    if (!row) throw new Error(`ingredient not seeded: ${name}`);
    return row.id;
  });
}

export async function recipeIdBySlug(db: PGlite, slug: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    "select id::int as id from public.recipes where slug = $1",
    [slug],
  );
  if (rows.length === 0) throw new Error(`recipe not seeded: ${slug}`);
  return rows[0].id;
}