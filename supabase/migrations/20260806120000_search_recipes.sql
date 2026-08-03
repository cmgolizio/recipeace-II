-- Cross-domain recipe search (docs/expansion-plan.md §12, §39, phase 14).
--
-- One search over the whole catalog, narrowable to a domain — not two search
-- implementations. A recipe matches on its own name or description, or on the
-- name of an ingredient it calls for (including that ingredient's aliases), so
-- "lime" finds the daiquiri and the tacos, and "scallions" finds the fried
-- rice through the alias table.
--
-- Ranking is deliberately simple and explainable: a name hit outranks a
-- description hit, which outranks an ingredient hit; ties break by name. It
-- uses the existing trigram indexes on recipes.name and ingredients.name
-- rather than introducing a search service (§12's closing rule).

create function public.search_recipes(
  q text,
  p_domain public.recipe_domain default null,
  max_results int default 30
)
returns table (
  recipe_id bigint,
  slug      text,
  name      text,
  domain    public.recipe_domain,
  image_url text,
  metadata  jsonb,
  matched   text,
  rank      int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with needle as (
    select '%' || btrim(coalesce(q, '')) || '%' as pattern,
           btrim(coalesce(q, '')) as term
  ),
  hits as (
    select r.id,
           case
             when r.name ilike n.pattern then 'name'
             when r.description ilike n.pattern then 'description'
             else 'ingredient'
           end as matched,
           case
             when r.name ilike n.pattern then 1
             when r.description ilike n.pattern then 2
             else 3
           end as rank
    from public.recipes r
    cross join needle n
    where n.term <> ''
      and r.is_published
      and (p_domain is null or r.domain = p_domain)
      and (
        r.name ilike n.pattern
        or r.description ilike n.pattern
        or exists (
          select 1
          from public.recipe_ingredients ri
          join public.ingredients i on i.id = ri.ingredient_id
          left join public.ingredient_aliases a on a.ingredient_id = i.id
          where ri.recipe_id = r.id
            and (i.name ilike n.pattern or a.alias ilike n.pattern)
        )
      )
  )
  select
    r.id as recipe_id,
    r.slug,
    r.name,
    r.domain,
    r.image_url,
    case r.domain
      when 'cocktail' then jsonb_strip_nulls(
        jsonb_build_object('method', cd.method, 'glass', cd.glass)
      )
      when 'food' then jsonb_strip_nulls(
        jsonb_build_object(
          'total_minutes', fd.total_minutes,
          'servings', fd.servings,
          'course', fd.course
        )
      )
      else '{}'::jsonb
    end as metadata,
    h.matched,
    h.rank
  from hits h
  join public.recipes r on r.id = h.id
  left join public.cocktail_recipe_details cd on cd.recipe_id = r.id
  left join public.food_recipe_details fd on fd.recipe_id = r.id
  order by h.rank, r.name
  limit greatest(1, least(coalesce(max_results, 30), 100));
$$;

comment on function public.search_recipes(text, public.recipe_domain, int) is
  'Published recipes matching a term by name, description, or the name or '
  'alias of an ingredient they call for. Both domains unless p_domain narrows '
  'it. Ranked name > description > ingredient, then alphabetically.';

grant execute on function public.search_recipes(text, public.recipe_domain, int)
  to anon, authenticated;