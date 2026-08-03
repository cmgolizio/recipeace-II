-- Recipe ingredient lines that food can actually use (docs/expansion-plan.md
-- §32, phase 7).
--
-- Three changes, all driven by how food recipes are written:
--
--   1. AN INGREDIENT MAY APPEAR TWICE. "2 tablespoons olive oil, divided",
--      butter in the dough and butter for the pan, salt in two stages. The
--      unique (recipe_id, ingredient_id) constraint made those impossible —
--      the cocktail validator silently dropped the second occurrence — and it
--      is the single hardest blocker for realistic food ingestion.
--
--   2. LINES BELONG TO SECTIONS. "For the sauce" / "For the topping".
--      A null section means the main list, which is every cocktail.
--
--   3. ORDER IS THE NATURAL KEY NOW. With ingredient_id no longer unique per
--      recipe, (recipe_id, display_order) identifies a line — which gives
--      seeds and upserts a conflict target and keeps ordering unambiguous.
--
-- The two functions that count ingredients have to stop counting a repeated
-- ingredient twice. Both are body-only changes: a recipe REQUIRES an
-- ingredient once, however many lines mention it, and a line is optional only
-- if every line mentioning that ingredient is optional.

alter table public.recipe_ingredients
  drop constraint recipe_ingredients_unique;

alter table public.recipe_ingredients
  add column section text;

comment on column public.recipe_ingredients.section is
  'Heading this line sits under ("For the sauce"). Null is the main list.';

alter table public.recipe_ingredients
  add constraint recipe_ingredients_line_unique unique (recipe_id, display_order);

comment on constraint recipe_ingredients_line_unique on public.recipe_ingredients is
  'One line per position. Replaces the old unique (recipe_id, ingredient_id), '
  'which forbade "olive oil, divided" appearing twice.';

-- ── match_recipes: count each required ingredient once ──────────────────────
create or replace function public.match_recipes(
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
  exact_pantry (id) as (
    select e from unnest(pantry) as e
    union
    select i.parent_id
    from exact_pantry ep
    join public.ingredients i on i.id = ep.id
    where i.parent_id is not null
  ),
  exact_base as (
    select id from exact_pantry
    union
    select id from public.ingredients where is_staple
  ),
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
  sub_set as (
    select s.substitute_id as id
    from public.ingredient_substitutions s
    where s.ingredient_id in (select id from exact_set)
    union
    select s.ingredient_id as id
    from public.ingredient_substitutions s
    where s.substitute_id in (select id from exact_set)
  ),
  -- One row per required ingredient per recipe, however many lines call for
  -- it; the earliest line decides where it sits in missing_ingredients.
  required as (
    select ri.recipe_id, ri.ingredient_id, min(ri.display_order) as display_order
    from public.recipe_ingredients ri
    join public.recipes r on r.id = ri.recipe_id
    where not ri.is_optional
      and r.is_published
      and (p_domain is null or r.domain = p_domain)
    group by ri.recipe_id, ri.ingredient_id
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

-- ── recipe_pantry_status: one row per ingredient, not per line ──────────────
-- The detail page renders its own lines and looks the status up by ingredient
-- id, so a repeated ingredient must not produce a repeated status row (it
-- would double-count in the "missing N ingredients" banner). An ingredient is
-- optional here only when every line mentioning it is optional.
create or replace function public.recipe_pantry_status(p_recipe_id bigint, pantry bigint[])
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
  exact_base as (
    select id from exact_pantry
    union
    select id from public.ingredients where is_staple
  ),
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
  sub_reach as (
    select s.ingredient_id as needs_id, s.substitute_id as via_id
    from public.ingredient_substitutions s
    where s.substitute_id in (select id from exact_set)
    union
    select s.substitute_id as needs_id, s.ingredient_id as via_id
    from public.ingredient_substitutions s
    where s.ingredient_id in (select id from exact_set)
  ),
  -- Collapse repeated lines: first line's quantity, and required wins over
  -- optional.
  lines as (
    select
      ri.ingredient_id,
      min(ri.display_order) as display_order,
      bool_and(ri.is_optional) as is_optional,
      bool_and(ri.is_garnish) as is_garnish,
      (array_agg(ri.amount order by ri.display_order))[1] as amount,
      (array_agg(ri.unit order by ri.display_order))[1] as unit,
      (array_agg(ri.preparation order by ri.display_order))[1] as preparation
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
    group by ri.ingredient_id
  )
  select
    l.ingredient_id,
    ing.name,
    l.amount,
    l.unit,
    l.preparation,
    l.is_optional,
    l.is_garnish,
    l.display_order,
    case
      when l.ingredient_id in (select id from exact_set) then 'have'
      when l.ingredient_id in (select needs_id from sub_reach) then 'substitute'
      else 'missing'
    end as status,
    case
      when l.ingredient_id not in (select id from exact_set) then (
        select v.name
        from sub_reach sr
        join public.ingredients v on v.id = sr.via_id
        where sr.needs_id = l.ingredient_id
        order by v.name
        limit 1
      )
      else null
    end as substitute_with,
    case
      when exists (
        select 1 from exact_expanded ee
        where ee.id = l.ingredient_id and ee.derived_src is null
      ) then null
      when l.ingredient_id in (select id from exact_set) then (
        select src.name
        from exact_expanded ee
        join public.ingredients src on src.id = ee.derived_src
        where ee.id = l.ingredient_id
        order by src.name
        limit 1
      )
      else null
    end as derived_from
  from lines l
  join public.ingredients ing on ing.id = l.ingredient_id
  order by l.display_order, ing.name;
$$;