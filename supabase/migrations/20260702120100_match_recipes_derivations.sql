-- match_recipes v2 — derivation-aware exact set, no zero-overlap results,
-- default max_missing of 2, and the missing ingredient names in the output.
--
-- Changes from v1 (20260622120100):
--   * The exact set now also expands through ingredient_derivations: owning a
--     whole orange counts as exactly having orange twist / orange juice. The
--     expansion is recursive so a derived item's own derivations and ancestors
--     resolve too.
--   * Recipes the pantry covers nothing of (exact_count = 0 AND
--     substitute_count = 0) are never returned, regardless of max_missing.
--   * max_missing defaults to 2 instead of null; pass null explicitly for
--     "show all with any overlap".
--   * New missing_ingredients column: names of the required ingredients that
--     are neither exact nor substitute-covered.
--
-- The return signature changes, so drop before recreating.

drop function if exists public.match_recipes(bigint[], int);

create function public.match_recipes(
  pantry bigint[],
  max_missing int default 2
)
returns table (
  recipe_id           bigint,
  required_count      int,
  exact_count         int,
  substitute_count    int,
  missing_count       int,
  missing_ingredients text[]
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
  -- Ancestor-expanded pantry + every staple.
  exact_base as (
    select id from exact_pantry
    union
    select id from public.ingredients where is_staple
  ),
  -- Exact coverage = the base set expanded through physical derivations
  -- (owning an orange yields orange twist / orange juice), recursively: a
  -- derived item's own derivations and ancestors resolve too. The edges are
  -- unioned so derivation and ancestor hops can interleave; the outer UNION
  -- dedups and terminates on cycles.
  exact_set (id) as (
    select id from exact_base
    union
    select edge.next_id
    from exact_set es
    join (
      select source_id as from_id, derived_id as next_id
      from public.ingredient_derivations
      union all
      select id as from_id, parent_id as next_id
      from public.ingredients
      where parent_id is not null
    ) edge on edge.from_id = es.id
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
    select distinct ri.recipe_id, ri.ingredient_id, ri.display_order
    from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where not ri.is_optional and r.is_published
  ),
  classified as (
    select
      req.recipe_id,
      req.ingredient_id,
      req.display_order,
      (es.id is not null) as is_exact,
      (ss.id is not null) as is_sub
    from required req
    left join exact_set es on es.id = req.ingredient_id
    left join sub_set ss on ss.id = req.ingredient_id
  ),
  scored as (
    select
      c.recipe_id,
      count(*)::int as required_count,
      (count(*) filter (where c.is_exact))::int as exact_count,
      (count(*) filter (where (not c.is_exact) and c.is_sub))::int as substitute_count,
      (count(*) filter (where (not c.is_exact) and (not c.is_sub)))::int as missing_count,
      coalesce(
        array_agg(i.name order by c.display_order, i.name)
          filter (where (not c.is_exact) and (not c.is_sub)),
        '{}'::text[]
      ) as missing_ingredients
    from classified c
    join public.ingredients i on i.id = c.ingredient_id
    group by c.recipe_id
  )
  select recipe_id, required_count, exact_count, substitute_count,
         missing_count, missing_ingredients
  from scored
  where (exact_count > 0 or substitute_count > 0)
    and (max_missing is null or missing_count <= max_missing)
  order by missing_count, substitute_count, required_count, recipe_id;
$$;

comment on function public.match_recipes(bigint[], int) is
  'Ranks published recipes by how well a pantry (array of owned ingredient ids) '
  'covers them. Exact = owned, an ancestor of something owned, a staple, or '
  'physically derivable from any of those (ingredient_derivations, recursive); '
  'close = one bidirectional substitution hop; optional ingredients are ignored. '
  'Recipes the pantry covers nothing of are never returned. max_missing defaults '
  'to 2; pass null for all recipes with any overlap. Returns per-recipe counts '
  'plus the missing ingredient names, ordered fewest-missing then '
  'fewest-substitutions.';

grant execute on function public.match_recipes(bigint[], int) to anon, authenticated;