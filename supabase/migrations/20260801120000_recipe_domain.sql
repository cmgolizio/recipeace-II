-- Recipe domain — the authoritative classification separating drinks from
-- food, and the foundation of the food expansion (docs/expansion-plan.md §8.1,
-- Decision 6).
--
-- This is the ONLY place domain is persisted as content classification.
-- Related records — recipe_ingredients, favorite_recipes, shopping-list
-- references, images — inherit it by joining to recipes and must never carry a
-- domain column of their own.
--
-- Order matters. The column arrives nullable, every existing row is backfilled
-- as 'cocktail' (the catalog was cocktail-only before this migration), the
-- backfill is asserted, and only then does NOT NULL apply.
--
-- Deliberately NO DEFAULT: a default would let a food recipe whose write path
-- forgot the column be silently filed as a cocktail. Every insert must state
-- the domain it is writing — the generated Insert type enforces this in
-- application code, and this constraint enforces it in the database.

create type public.recipe_domain as enum ('cocktail', 'food');

alter table public.recipes add column domain public.recipe_domain;

update public.recipes set domain = 'cocktail' where domain is null;

-- Fail loudly here rather than at the NOT NULL below, so the reason is legible.
do $$
declare
  unclassified bigint;
begin
  select count(*) into unclassified from public.recipes where domain is null;
  if unclassified > 0 then
    raise exception 'recipe domain backfill left % recipe(s) unclassified', unclassified;
  end if;
end;
$$;

alter table public.recipes alter column domain set not null;

comment on column public.recipes.domain is
  'Recipe content classification. Persisted only here — related tables derive '
  'domain by joining to recipes. No default: every write states its domain.';

-- Catalog and match queries filter on this from phase 2 onward. Single-column
-- for now; revisit a composite with is_published once those queries exist.
create index recipes_domain_idx on public.recipes (domain);
