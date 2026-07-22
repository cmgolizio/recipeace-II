-- popular_ingredients — the ingredients required by the most published
-- recipes, for "popular starting points" suggestions on an empty bar. Counts
-- required uses only (optional and garnish-role lines are ignored, matching
-- the matcher) and excludes staples (always on hand) and garnish-category
-- ingredients — the goal is bottles worth buying first, not decorations.
-- Ties break alphabetically so results are stable.

create function public.popular_ingredients(max_results int default 8)
returns table (
  id           bigint,
  name         text,
  recipe_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, count(*) as recipe_count
  from public.recipe_ingredients ri
  join public.recipes r on r.id = ri.recipe_id and r.is_published
  join public.ingredients i on i.id = ri.ingredient_id
  where not ri.is_optional
    and not ri.is_garnish
    and not i.is_staple
    and i.category <> 'garnish'
  group by i.id, i.name
  order by recipe_count desc, i.name asc
  limit greatest(1, least(coalesce(max_results, 8), 50));
$$;

comment on function public.popular_ingredients(int) is
  'Ingredients required by the most published recipes (optional/garnish uses '
  'ignored; staples and garnishes excluded), for empty-bar starter suggestions.';

grant execute on function public.popular_ingredients(int) to anon, authenticated;