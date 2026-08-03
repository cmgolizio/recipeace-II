-- Point the two functions that read cocktail metadata at its new home
-- (docs/expansion-plan.md §30, phase 5). Both keep their signatures, so
-- `create or replace` is enough and no caller changes.
--
--   match_recipes_detail — builds the card `metadata` object from
--     cocktail_recipe_details, and now fills the food branch too: a Kitchen
--     match card wants time and yield the way a Bar card wants method and
--     glass. Nulls are still stripped, so each domain's object carries only
--     the keys it actually has.
--
--   related_recipes — the base_spirit tiebreak, and the method/glass it
--     returns for the card, read from the detail table.
--
--   ingredient_detail — the recipes it lists span both domains, so each one
--     now carries a domain-shaped `metadata` object instead of bare
--     method/glass keys. The SQL return type is unchanged (it is jsonb), so
--     this is a body-only replacement.

create or replace function public.match_recipes_detail(
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
    coalesce(ri.items, '[]'::jsonb) as ingredients
  from public.match_recipes(pantry, max_missing, p_domain) with ordinality as m
  join public.recipes r on r.id = m.recipe_id
  left join public.cocktail_recipe_details cd on cd.recipe_id = r.id
  left join public.food_recipe_details fd on fd.recipe_id = r.id
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

create or replace function public.related_recipes(
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
    select r.id, r.domain, cd.base_spirit
    from public.recipes r
    left join public.cocktail_recipe_details cd on cd.recipe_id = r.id
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
    cd.method,
    cd.glass,
    r.image_url,
    count(*) as shared_count
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
  join public.recipes r on r.id = ri.recipe_id
  left join public.cocktail_recipe_details cd on cd.recipe_id = r.id
  cross join subject s
  where r.id <> s.id
    and r.is_published
    and r.domain = s.domain
    and ri.ingredient_id in (select ingredient_id from subject_ingredients)
    and not ri.is_garnish
    and not i.is_staple
    and i.category <> 'garnish'
  group by r.id, r.slug, r.name, cd.method, cd.glass, cd.base_spirit,
           r.image_url, s.base_spirit
  order by
    count(*) desc,
    -- Never null, so it can't sort above a real match under DESC.
    (s.base_spirit is not null and cd.base_spirit is not distinct from s.base_spirit) desc,
    r.name
  limit greatest(1, least(coalesce(max_results, 4), 24));
$$;

create or replace function public.ingredient_detail(
  p_slug text,
  p_domain public.recipe_domain default null
)
returns table (
  id          bigint,
  name        text,
  slug        text,
  category    public.ingredient_category,
  is_staple   boolean,
  recipes     jsonb,
  substitutes jsonb,
  derives     jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    i.id,
    i.name,
    i.slug,
    i.category,
    i.is_staple,
    coalesce(r.items, '[]'::jsonb) as recipes,
    coalesce(s.items, '[]'::jsonb) as substitutes,
    coalesce(d.items, '[]'::jsonb) as derives
  from public.ingredients i
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'id', rec.id,
               'slug', rec.slug,
               'name', rec.name,
               'domain', rec.domain,
               'image_url', rec.image_url,
               'metadata', case rec.domain
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
               end
             )
             order by rec.name
           ) as items
    from public.recipe_ingredients ri
    join public.recipes rec on rec.id = ri.recipe_id
    left join public.cocktail_recipe_details cd on cd.recipe_id = rec.id
    left join public.food_recipe_details fd on fd.recipe_id = rec.id
    where ri.ingredient_id = i.id
      and rec.is_published
      and (p_domain is null or rec.domain = p_domain)
  ) r on true
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('name', x.name, 'slug', x.slug, 'note', x.note)
             order by x.name
           ) as items
    from (
      -- One row per substitute even when the pair is recorded both ways;
      -- min() ignores nulls, so a note from either direction survives.
      select other.name, other.slug, min(sub.note) as note
      from public.ingredient_substitutions sub
      join public.ingredients other
        on other.id = case
             when sub.ingredient_id = i.id then sub.substitute_id
             else sub.ingredient_id
           end
      where sub.ingredient_id = i.id or sub.substitute_id = i.id
      group by other.name, other.slug
    ) x
  ) s on true
  left join lateral (
    select jsonb_agg(
             jsonb_build_object('name', der.name, 'slug', der.slug)
             order by der.name
           ) as items
    from public.ingredient_derivations dv
    join public.ingredients der on der.id = dv.derived_id
    where dv.source_id = i.id
  ) d on true
  where i.slug = p_slug;
$$;