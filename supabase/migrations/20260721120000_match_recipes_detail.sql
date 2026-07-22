-- match_recipes_detail — everything the matches page renders, in one round
-- trip. The page previously called match_recipes and then fetched the matched
-- recipes (with their ingredient lists) in a second query; this companion
-- function does that join server-side. Ranking is inherited from
-- match_recipes verbatim (WITH ORDINALITY preserves its row order), and the
-- ingredient objects are ordered by display_order then name — the same order
-- the cards render.

create function public.match_recipes_detail(
  pantry bigint[],
  max_missing int default 2
)
returns table (
  recipe_id           bigint,
  required_count      int,
  exact_count         int,
  substitute_count    int,
  missing_count       int,
  missing_ingredients text[],
  slug                text,
  name                text,
  method              text,
  glass               text,
  ingredients         jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.recipe_id,
    m.required_count,
    m.exact_count,
    m.substitute_count,
    m.missing_count,
    m.missing_ingredients,
    r.slug,
    r.name,
    r.method,
    r.glass,
    coalesce(ri.items, '[]'::jsonb) as ingredients
  from public.match_recipes(pantry, max_missing) with ordinality as m
  join public.recipes r on r.id = m.recipe_id
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'name', i.name,
               'amount', ri.amount,
               'unit', ri.unit,
               'is_optional', ri.is_optional
             )
             order by ri.display_order, i.name
           ) as items
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = m.recipe_id
  ) ri on true
  order by m.ordinality;
$$;

comment on function public.match_recipes_detail(bigint[], int) is
  'match_recipes plus the fields the matches page renders: recipe card '
  'fields and the full ingredient list as a jsonb array of {name, amount, '
  'unit, is_optional}, ordered by display_order then name. Same rows, same '
  'order, same parameters as match_recipes.';

grant execute on function public.match_recipes_detail(bigint[], int) to anon, authenticated;