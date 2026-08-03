-- One matcher, two domains (docs/expansion-plan.md §28, phase 3; Decision 9).
--
-- Nothing about the matching *rules* changes here. The ancestor walk, the
-- staple union, the recursive derivation expansion, the one-hop bidirectional
-- substitution reach, the scoring and the ordering are all carried over
-- verbatim from 20260702120100. The only additions are:
--
--   * p_domain — which slice of the catalog to consider. Null means every
--     domain; the application always passes a value.
--   * match_recipes_detail returns `domain` and a domain-shaped `metadata`
--     object instead of the cocktail-only `method` / `glass` columns, so a
--     food match card is not handed five null drink fields (invariant 14).
--
-- STAPLE POLICY (plan §11.4). Staples are global and unconditional: an
-- ingredient with ingredients.is_staple is treated as owned by everyone, in
-- every domain. Today that is water, ice, crushed ice, sugar and salt. Adding
-- a staple therefore changes cocktail results as well as food ones, so the
-- set stays deliberately tiny — flour, pepper and neutral oil are NOT staples
-- — and the Kitchen match UI states the assumption rather than hiding it.
-- Per-user staple configuration is post-MVP (plan §43.1).
--
-- Both signatures change, so both are dropped first. _detail depends on
-- match_recipes, so it is dropped first and recreated last.

drop function if exists public.match_recipes_detail(bigint[], int);
drop function if exists public.match_recipes(bigint[], int);

create function public.match_recipes(
  pantry bigint[],
  max_missing int default 2,
  p_domain public.recipe_domain default null
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
  -- Ancestor-expanded pantry + every staple. Staples are cross-domain by
  -- design: one pantry, one assumption set.
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
  -- Required (non-optional) ingredients of each published recipe in the
  -- requested domain. Optional lines never reach the score, so a garnish or a
  -- "for serving" line can't make a recipe look unavailable.
  required as (
    select distinct ri.recipe_id, ri.ingredient_id, ri.display_order
    from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where not ri.is_optional
      and r.is_published
      and (p_domain is null or r.domain = p_domain)
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

comment on function public.match_recipes(bigint[], int, public.recipe_domain) is
  'Ranks published recipes by how well a pantry (array of owned ingredient ids) '
  'covers them, within one recipe domain (p_domain null = every domain). Exact '
  '= owned, an ancestor of something owned, a staple, or physically derivable '
  'from any of those (ingredient_derivations, recursive); close = one '
  'bidirectional substitution hop; optional ingredients are ignored. Recipes '
  'the pantry covers nothing of are never returned. max_missing defaults to 2; '
  'pass null for all recipes with any overlap. Returns per-recipe counts plus '
  'the missing ingredient names, ordered fewest-missing then '
  'fewest-substitutions.';

grant execute on function public.match_recipes(bigint[], int, public.recipe_domain)
  to anon, authenticated;

create function public.match_recipes_detail(
  pantry bigint[],
  max_missing int default 2,
  p_domain public.recipe_domain default null
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
  domain              public.recipe_domain,
  metadata            jsonb,
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
    r.domain,
    -- Whatever this domain puts on a card, and nothing else. Nulls are
    -- stripped so a caller can render the keys it finds without null checks.
    case r.domain
      when 'cocktail' then jsonb_strip_nulls(
        jsonb_build_object('method', r.method, 'glass', r.glass)
      )
      else '{}'::jsonb
    end as metadata,
    coalesce(ri.items, '[]'::jsonb) as ingredients
  from public.match_recipes(pantry, max_missing, p_domain) with ordinality as m
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

comment on function public.match_recipes_detail(bigint[], int, public.recipe_domain) is
  'match_recipes plus the fields a match card renders: slug, name, domain, a '
  'domain-shaped metadata object, and the full ingredient list as a jsonb '
  'array of {name, amount, unit, is_optional} ordered by display_order then '
  'name. Same rows, same order, same parameters as match_recipes.';

grant execute on function public.match_recipes_detail(bigint[], int, public.recipe_domain)
  to anon, authenticated;

-- The matcher and the catalog both filter (domain, is_published) together now.
-- The composite serves domain-only lookups as well, so the single-column index
-- added in 20260801120000 is redundant.
drop index if exists public.recipes_domain_idx;
create index recipes_domain_published_idx on public.recipes (domain, is_published);