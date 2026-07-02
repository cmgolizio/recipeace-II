-- match_recipes — rank recipes against a pantry.
--
-- Given the ingredient ids a user owns, score every published recipe by how
-- well the pantry covers its required (non-optional) ingredients:
--
--   exact   — the recipe ingredient is owned, is an ancestor of something owned
--             (own bourbon ⇒ have whiskey), or is a staple (always on hand).
--   close   — not exact, but reachable in one bidirectional substitution hop.
--   missing — neither.
--
-- Results are ordered best-first: fewest missing, then fewest substitutions.
-- Pass max_missing to keep only recipes you can (almost) make.

create or replace function public.match_recipes(
  pantry bigint[],
  max_missing int default null
)
returns table (
  recipe_id        bigint,
  required_count   int,
  exact_count      int,
  substitute_count int,
  missing_count    int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive
  -- Owned ingredients plus all of their ancestors (walk parent_id upward).
  -- UNION (not UNION ALL) dedups and terminates on any accidental cycle.
  exact_pantry (id) as (
    select e from unnest(pantry) as e
    union
    select i.parent_id
    from exact_pantry ep
    join public.ingredients i on i.id = ep.id
    where i.parent_id is not null
  ),
  -- Exact coverage = ancestor-expanded pantry + every staple.
  exact_set as (
    select id from exact_pantry
    union
    select id from public.ingredients where is_staple
  ),
  -- One "in a pinch" hop from the exact set, in either direction.
  sub_set as (
    select s.substitute_id as id
    from public.ingredient_substitutions s
    where s.ingredient_id in (select id from exact_set)
    union
    select s.ingredient_id as id
    from public.ingredient_substitutions s
    where s.substitute_id in (select id from exact_set)
  ),
  -- Required (non-optional) ingredients of each published recipe.
  required as (
    select distinct ri.recipe_id, ri.ingredient_id
    from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where not ri.is_optional and r.is_published
  ),
  classified as (
    select
      req.recipe_id,
      (es.id is not null) as is_exact,
      (ss.id is not null) as is_sub
    from required req
    left join exact_set es on es.id = req.ingredient_id
    left join sub_set ss on ss.id = req.ingredient_id
  ),
  scored as (
    select
      recipe_id,
      count(*)::int as required_count,
      (count(*) filter (where is_exact))::int as exact_count,
      (count(*) filter (where (not is_exact) and is_sub))::int as substitute_count,
      (count(*) filter (where (not is_exact) and (not is_sub)))::int as missing_count
    from classified
    group by recipe_id
  )
  select recipe_id, required_count, exact_count, substitute_count, missing_count
  from scored
  where max_missing is null or missing_count <= max_missing
  order by missing_count, substitute_count, required_count, recipe_id;
$$;

comment on function public.match_recipes(bigint[], int) is
  'Ranks published recipes by how well a pantry (array of owned ingredient ids) '
  'covers them. Exact = owned, an ancestor of something owned, or a staple; '
  'close = one bidirectional substitution hop; optional ingredients are ignored. '
  'Returns per-recipe counts ordered fewest-missing then fewest-substitutions.';

grant execute on function public.match_recipes(bigint[], int) to anon, authenticated;