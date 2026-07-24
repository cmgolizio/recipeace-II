-- Recipe metadata for browsing depth: estimated strength (ABV %), difficulty,
-- a controlled flavor-tag vocabulary, and the base spirit. Populated by the
-- offline pipeline (scripts/pipeline/run.ts for new recipes,
-- scripts/pipeline/enrich.ts as the backfill); all nullable / defaulted so
-- existing rows and inserts keep working untouched.

create type public.recipe_difficulty as enum ('easy', 'medium', 'advanced');

alter table public.recipes
  add column strength    smallint,                        -- estimated ABV %, approximate
  add column difficulty  public.recipe_difficulty,
  add column flavor_tags text[] not null default '{}',    -- controlled vocabulary, see pipeline validate.ts
  add column base_spirit text;

create index recipes_flavor_tags_idx on public.recipes using gin (flavor_tags);
create index recipes_base_spirit_idx on public.recipes (base_spirit);
