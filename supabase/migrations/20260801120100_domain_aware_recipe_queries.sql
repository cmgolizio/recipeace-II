-- Domain-aware recipe reads (docs/expansion-plan.md §27, phase 2).
--
-- Two functions return recipe lists and neither could express a domain:
--
--   ingredient_detail — a shared ingredient page (lime juice, mint, sugar)
--     legitimately spans both domains, so this gains an OPTIONAL filter:
--     p_domain null (the default) keeps today's behaviour of listing every
--     published recipe, and each recipe object now carries its own domain so
--     a caller can group without a second round trip.
--
--   related_recipes — "more like this" must not cross domains. A cocktail is
--     not more like a soup for sharing lime juice. Scoped to the subject
--     recipe's own domain; body-only change, so the signature is untouched.
--
-- Adding a parameter changes ingredient_detail's identity, so it is dropped
-- and recreated rather than replaced.

drop function if exists public.ingredient_detail(text);

create function public.ingredient_detail(
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
               'method', rec.method,
               'glass', rec.glass,
               'image_url', rec.image_url
             )
             order by rec.name
           ) as items
    from public.recipe_ingredients ri
    join public.recipes rec on rec.id = ri.recipe_id
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

comment on function public.ingredient_detail(text, public.recipe_domain) is
  'One ingredient by slug, with the published recipes using it (both domains '
  'unless p_domain narrows them, each tagged with its own domain), its '
  'substitutes (both directions), and the ingredients it directly derives — '
  'each as a jsonb array. No rows for an unknown slug.';

grant execute on function public.ingredient_detail(text, public.recipe_domain)
  to anon, authenticated;

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
    select r.id, r.domain, r.base_spirit
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
    -- Same domain only: shared ingredients don't make a cocktail and a
    -- casserole alike.
    and r.domain = s.domain
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
  'Published recipes in the same domain as p_recipe_id, ranked by shared '
  'non-staple, non-garnish ingredient count, with a matching base_spirit as a '
  'tiebreak. Recipes sharing nothing are not returned.';
