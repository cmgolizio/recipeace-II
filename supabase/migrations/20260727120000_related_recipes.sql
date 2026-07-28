-- related_recipes — the "More like this" row on a recipe detail page.
--
-- Ranks other published recipes by how many ingredients they share with the
-- subject, counting only the ingredients that actually characterise a drink:
-- staples (always on hand) and garnishes contribute nothing to "similar", so
-- they're excluded on both sides, the same way popular_ingredients does it.
-- base_spirit is a tiebreak booster only — two recipes with the same shared
-- count rank the same-spirit one first — so this stays useful whether or not
-- the enrichment pipeline has filled that column in.

create function public.related_recipes(
  p_recipe_id bigint,
  max_results int default 4
)
returns table (
  recipe_id    bigint,
  slug         text,
  name         text,
  method       text,
  glass        text,
  image_url    text,
  shared_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with subject as (
    select r.id, r.base_spirit
    from public.recipes r
    where r.id = p_recipe_id
  ),
  subject_ingredients as (
    select ri.ingredient_id
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = p_recipe_id
      and not ri.is_garnish
      and not i.is_staple
      and i.category <> 'garnish'
  )
  select
    r.id as recipe_id,
    r.slug,
    r.name,
    r.method,
    r.glass,
    r.image_url,
    count(*) as shared_count
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
  join public.recipes r on r.id = ri.recipe_id
  cross join subject s
  where r.id <> s.id
    and r.is_published
    and ri.ingredient_id in (select ingredient_id from subject_ingredients)
    and not ri.is_garnish
    and not i.is_staple
    and i.category <> 'garnish'
  group by r.id, r.slug, r.name, r.method, r.glass, r.image_url, s.base_spirit
  order by
    count(*) desc,
    -- Never null, so it can't sort above a real match under DESC.
    (s.base_spirit is not null and r.base_spirit is not distinct from s.base_spirit) desc,
    r.name
  limit greatest(1, least(coalesce(max_results, 4), 24));
$$;

comment on function public.related_recipes(bigint, int) is
  'Published recipes most similar to p_recipe_id, ranked by shared non-staple, '
  'non-garnish ingredient count, with a matching base_spirit as a tiebreak. '
  'Recipes sharing nothing are not returned.';

grant execute on function public.related_recipes(bigint, int) to anon, authenticated;