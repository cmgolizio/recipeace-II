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