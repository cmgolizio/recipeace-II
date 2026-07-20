-- Favorites — recipes a signed-in user has hearted. Owner-only, same policy
-- style as pantry_items in 20260622120000_initial_schema.sql (auth.uid()
-- wrapped in a sub-select so the planner evaluates it once per query).

create table public.favorite_recipes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   bigint not null references public.recipes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index favorite_recipes_recipe_id_idx on public.favorite_recipes (recipe_id);

alter table public.favorite_recipes enable row level security;

create policy "Users can view their own favorites"
  on public.favorite_recipes for select using ((select auth.uid()) = user_id);
create policy "Users can add their own favorites"
  on public.favorite_recipes for insert with check ((select auth.uid()) = user_id);
create policy "Users can remove their own favorites"
  on public.favorite_recipes for delete using ((select auth.uid()) = user_id);