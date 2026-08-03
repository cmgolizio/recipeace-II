-- Shared recipe, domain-specific details (docs/expansion-plan.md §30, phase 5).
--
-- `recipes` becomes what §5.2 describes: only the fields that apply to every
-- domain — identity, slug, name, description, instructions, image, source,
-- publication, timestamps, domain, difficulty. Everything that is true only of
-- a drink, or only of a dish, moves to a detail table keyed by recipe_id.
--
-- Neither detail table carries a `domain` column. §3 forbids it explicitly:
-- domain is persisted once, on recipes, and a detail row derives it by joining.
-- The pairing "cocktail recipes have cocktail details" is enforced by the
-- writers (the pipeline validators and the typed insert paths) and asserted by
-- tests, not by a cross-table trigger (§8.3).
--
-- This migration is additive. The old cocktail columns on `recipes` are left
-- in place, marked deprecated, and dropped in the phase 17 cleanup once
-- production has confirmed nothing reads them (§23).

create table public.cocktail_recipe_details (
  recipe_id   bigint primary key references public.recipes (id) on delete cascade,
  method      text,
  glass       text,
  garnish     text,
  strength    smallint check (strength between 0 and 100),
  base_spirit text,
  flavor_tags text[] not null default '{}'
);

comment on table public.cocktail_recipe_details is
  'Drink-only metadata for a recipe whose domain is cocktail. At most one row '
  'per recipe (recipe_id is the primary key). No domain column — join to '
  'recipes for that.';

create index cocktail_recipe_details_flavor_tags_idx
  on public.cocktail_recipe_details using gin (flavor_tags);
create index cocktail_recipe_details_base_spirit_idx
  on public.cocktail_recipe_details (base_spirit);

create table public.food_recipe_details (
  recipe_id     bigint primary key references public.recipes (id) on delete cascade,
  prep_minutes  int check (prep_minutes >= 0),
  cook_minutes  int check (cook_minutes >= 0),
  total_minutes int check (total_minutes >= 0),
  servings      int check (servings > 0),
  course        text,
  cuisine       text
);

comment on table public.food_recipe_details is
  'Food-only metadata for a recipe whose domain is food: times, yield, course '
  'and cuisine. At most one row per recipe. Deliberately small — only the '
  'fields the Kitchen interface needs (plan §30).';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every cocktail gets a row, even an entirely empty one, so "a cocktail has
-- exactly one details row" is a real invariant rather than a usually-true one.
insert into public.cocktail_recipe_details
  (recipe_id, method, glass, garnish, strength, base_spirit, flavor_tags)
select id, method, glass, garnish, strength, base_spirit, flavor_tags
from public.recipes
where domain = 'cocktail';

do $$
declare
  unmigrated bigint;
begin
  select count(*) into unmigrated
  from public.recipes r
  left join public.cocktail_recipe_details d on d.recipe_id = r.id
  where r.domain = 'cocktail' and d.recipe_id is null;
  if unmigrated > 0 then
    raise exception 'cocktail detail backfill missed % recipe(s)', unmigrated;
  end if;
end;
$$;

comment on column public.recipes.method is
  'DEPRECATED — moved to cocktail_recipe_details.method in phase 5. Dropped in '
  'phase 17 cleanup.';
comment on column public.recipes.glass is
  'DEPRECATED — moved to cocktail_recipe_details.glass in phase 5.';
comment on column public.recipes.garnish is
  'DEPRECATED — moved to cocktail_recipe_details.garnish in phase 5.';
comment on column public.recipes.strength is
  'DEPRECATED — moved to cocktail_recipe_details.strength in phase 5.';
comment on column public.recipes.base_spirit is
  'DEPRECATED — moved to cocktail_recipe_details.base_spirit in phase 5.';
comment on column public.recipes.flavor_tags is
  'DEPRECATED — moved to cocktail_recipe_details.flavor_tags in phase 5.';

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same shape as recipe_ingredients: readable exactly when the recipe it
-- belongs to is published, and writable only through the secret key.
alter table public.cocktail_recipe_details enable row level security;
alter table public.food_recipe_details     enable row level security;

create policy "Cocktail details of published recipes are readable by everyone"
  on public.cocktail_recipe_details for select using (
    exists (
      select 1 from public.recipes r
      where r.id = cocktail_recipe_details.recipe_id and r.is_published
    )
  );

create policy "Food details of published recipes are readable by everyone"
  on public.food_recipe_details for select using (
    exists (
      select 1 from public.recipes r
      where r.id = food_recipe_details.recipe_id and r.is_published
    )
  );

-- ── Domain catalog views ────────────────────────────────────────────────────
-- A catalog page filters, sorts and paginates over shared *and* domain fields
-- in one query. These views give each domain a flat table to do that against,
-- while the storage underneath stays normalised. security_invoker keeps the
-- base tables' RLS in force for whoever is querying.

create view public.cocktail_recipes with (security_invoker = on) as
select
  r.id, r.slug, r.name, r.description, r.domain, r.instructions, r.source,
  r.is_published, r.image_url, r.created_at, r.updated_at, r.difficulty,
  d.method, d.glass, d.garnish, d.strength, d.base_spirit,
  coalesce(d.flavor_tags, '{}'::text[]) as flavor_tags
from public.recipes r
left join public.cocktail_recipe_details d on d.recipe_id = r.id
where r.domain = 'cocktail';

comment on view public.cocktail_recipes is
  'Every cocktail recipe with its drink metadata flattened alongside the '
  'shared fields, for catalog filtering and sorting. Read-only; RLS is the '
  'base tables''.';

create view public.food_recipes with (security_invoker = on) as
select
  r.id, r.slug, r.name, r.description, r.domain, r.instructions, r.source,
  r.is_published, r.image_url, r.created_at, r.updated_at, r.difficulty,
  d.prep_minutes, d.cook_minutes, d.total_minutes, d.servings,
  d.course, d.cuisine
from public.recipes r
left join public.food_recipe_details d on d.recipe_id = r.id
where r.domain = 'food';

comment on view public.food_recipes is
  'Every food recipe with its food metadata flattened alongside the shared '
  'fields, for catalog filtering and sorting. Read-only; RLS is the base '
  'tables''.';

grant select on public.cocktail_recipes to anon, authenticated;
grant select on public.food_recipes to anon, authenticated;