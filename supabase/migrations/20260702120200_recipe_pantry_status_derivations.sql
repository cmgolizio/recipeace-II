-- recipe_pantry_status v2 — derivation-aware, with derived_from provenance.
--
-- Mirrors match_recipes v2: the exact set expands through
-- ingredient_derivations (owning an orange counts as exactly having orange
-- twist / orange juice). When an ingredient is satisfied only via derivation,
-- status stays 'have' and the new derived_from column carries the source
-- ingredient's name so the UI can render "have, via orange". It is null when
-- the ingredient is directly owned, an ancestor of something owned, or a
-- staple.
--
-- The return signature changes, so drop before recreating.

drop function if exists public.recipe_pantry_status(bigint, bigint[]);

create function public.recipe_pantry_status(p_recipe_id bigint, pantry bigint[])
returns table (
  ingredient_id   bigint,
  name            text,
  amount          numeric,
  unit            text,
  preparation     text,
  is_optional     boolean,
  is_garnish      boolean,
  display_order   integer,
  status          text,
  substitute_with text,
  derived_from    text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive exact_pantry (id) as (
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
  -- Expand the base set through physical derivations, recursively (a derived
  -- item's own derivations and ancestors resolve too). derived_src tracks the
  -- first derivation source on the path — null means the ingredient is covered
  -- directly (owned / ancestor / staple), no derivation involved.
  exact_expanded (id, derived_src) as (
    select id, null::bigint from exact_base
    union
    select edge.next_id, coalesce(ee.derived_src, edge.src)
    from exact_expanded ee
    join (
      select source_id as from_id, derived_id as next_id, source_id as src
      from public.ingredient_derivations
      union all
      select id as from_id, parent_id as next_id, null::bigint as src
      from public.ingredients
      where parent_id is not null
    ) edge on edge.from_id = ee.id
  ),
  exact_set as (
    select distinct id from exact_expanded
  ),
  -- needs_id: an ingredient a recipe might call for; via_id: an owned/effective
  -- ingredient that can stand in for it (one bidirectional substitution hop).
  sub_reach as (
    select s.ingredient_id as needs_id, s.substitute_id as via_id
    from public.ingredient_substitutions s
    where s.substitute_id in (select id from exact_set)
    union
    select s.substitute_id as needs_id, s.ingredient_id as via_id
    from public.ingredient_substitutions s
    where s.ingredient_id in (select id from exact_set)
  )
  select
    ri.ingredient_id,
    ing.name,
    ri.amount,
    ri.unit,
    ri.preparation,
    ri.is_optional,
    ri.is_garnish,
    ri.display_order,
    case
      when ri.ingredient_id in (select id from exact_set) then 'have'
      when ri.ingredient_id in (select needs_id from sub_reach) then 'substitute'
      else 'missing'
    end as status,
    case
      when ri.ingredient_id not in (select id from exact_set) then (
        select v.name
        from sub_reach sr
        join public.ingredients v on v.id = sr.via_id
        where sr.needs_id = ri.ingredient_id
        order by v.name
        limit 1
      )
      else null
    end as substitute_with,
    case
      -- Covered directly (owned / ancestor / staple): no derivation to credit.
      when exists (
        select 1 from exact_expanded ee
        where ee.id = ri.ingredient_id and ee.derived_src is null
      ) then null
      -- In the exact set only via derivation: name the source ingredient.
      when ri.ingredient_id in (select id from exact_set) then (
        select src.name
        from exact_expanded ee
        join public.ingredients src on src.id = ee.derived_src
        where ee.id = ri.ingredient_id
        order by src.name
        limit 1
      )
      else null
    end as derived_from
  from public.recipe_ingredients ri
  join public.ingredients ing on ing.id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id
  order by ri.display_order, ing.name;
$$;

comment on function public.recipe_pantry_status(bigint, bigint[]) is
  'Per-ingredient have / substitute / missing status of a recipe against a pantry '
  '(array of owned ingredient ids), reusing the match_recipes expansion. When an '
  'ingredient is only covered by a physical derivation, status is ''have'' and '
  'derived_from names the owned source ingredient.';

grant execute on function public.recipe_pantry_status(bigint, bigint[]) to anon, authenticated;