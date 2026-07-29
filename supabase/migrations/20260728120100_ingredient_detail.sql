-- ingredient_detail — everything an /ingredients/[slug] page renders, in one
-- round trip: the ingredient itself, the published recipes that call for it,
-- what can stand in for it, and what owning it yields.
--
-- Substitutions are read in BOTH directions, matching how the matcher treats
-- them; derivations are read one-way (source → derived), matching their
-- one-way semantics, and only the direct edges — the transitive closure the
-- matcher walks is an implementation detail, not something to list on a page.

create function public.ingredient_detail(p_slug text)
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

comment on function public.ingredient_detail(text) is
  'One ingredient by slug, with the published recipes using it, its '
  'substitutes (both directions), and the ingredients it directly derives — '
  'each as a jsonb array. No rows for an unknown slug.';

grant execute on function public.ingredient_detail(text) to anon, authenticated;