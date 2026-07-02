-- Recipeace — initial schema (cocktail pantry-matching app)
--
-- Reference & content data (ingredients, aliases, substitutions, recipes) is
-- world-readable and written only by the offline pipeline using the Supabase
-- secret key (which bypasses RLS). User data (profiles, pantry) is owner-only.

-- ── Extensions ──────────────────────────────────────────────────────────────
-- pg_trgm powers fuzzy name/alias lookup. Kept out of the public schema per
-- Supabase guidance.
create extension if not exists pg_trgm with schema extensions;

-- ── Enums ───────────────────────────────────────────────────────────────────
-- Mirrors the `Category` union in src/data/cocktail-seed.ts.
create type public.ingredient_category as enum (
  'spirit', 'liqueur', 'fortified_wine', 'wine', 'bitters', 'mixer',
  'juice', 'syrup', 'dairy', 'produce', 'garnish', 'other', 'staple'
);

-- ── Ingredients ─────────────────────────────────────────────────────────────
create table public.ingredients (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  category    public.ingredient_category not null,
  parent_id   bigint references public.ingredients (id) on delete set null,
  is_staple   boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.ingredients is
  'Canonical cocktail ingredients. parent_id forms an is-a hierarchy: owning a '
  'child (e.g. bourbon) satisfies a recipe calling for an ancestor (whiskey). '
  'Staples (is_staple) are assumed always on hand.';

create index ingredients_parent_id_idx on public.ingredients (parent_id);
create index ingredients_category_idx on public.ingredients (category);
create index ingredients_staple_idx on public.ingredients (id) where is_staple;
create index ingredients_name_trgm_idx
  on public.ingredients using gin (name extensions.gin_trgm_ops);

-- ── Ingredient aliases (brand / spelling → canonical) ───────────────────────
create table public.ingredient_aliases (
  id             bigint generated always as identity primary key,
  alias          text not null unique,
  ingredient_id  bigint not null references public.ingredients (id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index ingredient_aliases_ingredient_id_idx
  on public.ingredient_aliases (ingredient_id);
create index ingredient_aliases_alias_trgm_idx
  on public.ingredient_aliases using gin (alias extensions.gin_trgm_ops);

-- ── Ingredient substitutions (looser "in a pinch" swaps) ────────────────────
create table public.ingredient_substitutions (
  id             bigint generated always as identity primary key,
  ingredient_id  bigint not null references public.ingredients (id) on delete cascade,
  substitute_id  bigint not null references public.ingredients (id) on delete cascade,
  note           text,
  created_at     timestamptz not null default now(),
  constraint ingredient_substitutions_distinct check (ingredient_id <> substitute_id),
  constraint ingredient_substitutions_unique unique (ingredient_id, substitute_id)
);

comment on table public.ingredient_substitutions is
  'Looser swaps surfaced as "close" matches, not exact. Treated bidirectionally '
  'by the matcher.';

create index ingredient_substitutions_substitute_id_idx
  on public.ingredient_substitutions (substitute_id);

-- ── Recipes ─────────────────────────────────────────────────────────────────
create table public.recipes (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  name          text not null,
  description   text,
  method        text,                                   -- shaken / stirred / built / ...
  glass         text,
  garnish       text,                                   -- free-text garnish description
  instructions  text[] not null default '{}',           -- ordered steps
  source        text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index recipes_name_trgm_idx
  on public.recipes using gin (name extensions.gin_trgm_ops);
create index recipes_published_idx on public.recipes (is_published);

-- ── Recipe ingredients ──────────────────────────────────────────────────────
create table public.recipe_ingredients (
  id             bigint generated always as identity primary key,
  recipe_id      bigint not null references public.recipes (id) on delete cascade,
  ingredient_id  bigint not null references public.ingredients (id) on delete restrict,
  amount         numeric,
  unit           text,                                  -- oz / dash / barspoon / ...
  preparation    text,                                  -- "freshly squeezed", "muddled"
  is_optional    boolean not null default false,        -- ignored by the matcher
  is_garnish     boolean not null default false,
  display_order  integer not null default 0,
  raw_text       text,                                  -- original pipeline line (provenance)
  constraint recipe_ingredients_unique unique (recipe_id, ingredient_id)
);

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Pantry (a user's owned ingredients) ─────────────────────────────────────
create table public.pantry_items (
  user_id        uuid not null references auth.users (id) on delete cascade,
  ingredient_id  bigint not null references public.ingredients (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, ingredient_id)
);

create index pantry_items_ingredient_id_idx on public.pantry_items (ingredient_id);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Auto-create a profile row on signup ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Reference & content tables: world-readable. Writes only via the secret key,
-- which bypasses RLS (no write policies exist).
alter table public.ingredients              enable row level security;
alter table public.ingredient_aliases       enable row level security;
alter table public.ingredient_substitutions enable row level security;
alter table public.recipes                  enable row level security;
alter table public.recipe_ingredients       enable row level security;

create policy "Ingredients are readable by everyone"
  on public.ingredients for select using (true);
create policy "Aliases are readable by everyone"
  on public.ingredient_aliases for select using (true);
create policy "Substitutions are readable by everyone"
  on public.ingredient_substitutions for select using (true);
create policy "Published recipes are readable by everyone"
  on public.recipes for select using (is_published);
create policy "Ingredients of published recipes are readable by everyone"
  on public.recipe_ingredients for select using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id and r.is_published
    )
  );

-- User data: owner-only. auth.uid() is wrapped in a sub-select so the planner
-- evaluates it once per query (Supabase RLS performance guidance).
alter table public.profiles     enable row level security;
alter table public.pantry_items enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using ((select auth.uid()) = id);
create policy "Users can insert their own profile"
  on public.profiles for insert with check ((select auth.uid()) = id);
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Users can view their own pantry"
  on public.pantry_items for select using ((select auth.uid()) = user_id);
create policy "Users can add to their own pantry"
  on public.pantry_items for insert with check ((select auth.uid()) = user_id);
create policy "Users can remove from their own pantry"
  on public.pantry_items for delete using ((select auth.uid()) = user_id);