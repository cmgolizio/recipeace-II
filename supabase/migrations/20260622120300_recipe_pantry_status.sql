-- recipe_pantry_status — per-ingredient status of one recipe against a pantry.
--
-- Mirrors match_recipes' expansion (owned + ancestors + staples = "have"; one
-- bidirectional substitution hop = "substitute") but returns a row per recipe
-- ingredient so a detail page can show have / substitute / missing inline, plus
-- which owned ingredient can stand in.

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
  substitute_with text
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
  exact_set as (
    select id from exact_pantry
    union
    select id from public.ingredients where is_staple
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
    end as substitute_with
  from public.recipe_ingredients ri
  join public.ingredients ing on ing.id = ri.ingredient_id
  where ri.recipe_id = p_recipe_id
  order by ri.display_order, ing.name;
$$;

comment on function public.recipe_pantry_status(bigint, bigint[]) is
  'Per-ingredient have / substitute / missing status of a recipe against a pantry '
  '(array of owned ingredient ids), reusing the match_recipes expansion.';

grant execute on function public.recipe_pantry_status(bigint, bigint[]) to anon, authenticated;