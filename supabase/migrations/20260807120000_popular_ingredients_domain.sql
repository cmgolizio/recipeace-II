-- popular_ingredients gains a domain filter. Without it the starter strip
-- counts across the whole catalog, and at 160 cocktails to 13 dishes that
-- means the Kitchen's suggestions are always somebody else's bottles.
--
-- Dropped rather than replaced: adding a second defaulted argument to the
-- existing signature would leave two candidate functions and make the
-- one-argument call ambiguous.

drop function if exists public.popular_ingredients(int);

create function public.popular_ingredients(
  max_results int default 8,
  p_domain public.recipe_domain default null
)
returns table (
  id           bigint,
  name         text,
  recipe_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, count(*) as recipe_count
  from public.recipe_ingredients ri
  join public.recipes r on r.id = ri.recipe_id and r.is_published
  join public.ingredients i on i.id = ri.ingredient_id
  where not ri.is_optional
    and not ri.is_garnish
    and not i.is_staple
    and i.category <> 'garnish'
    and (p_domain is null or r.domain = p_domain)
  group by i.id, i.name
  order by recipe_count desc, i.name asc
  limit greatest(1, least(coalesce(max_results, 8), 50));
$$;

comment on function public.popular_ingredients(int, public.recipe_domain) is
  'Ingredients required by the most published recipes (optional/garnish uses '
  'ignored; staples and garnishes excluded), optionally scoped to one domain. '
  'For empty-pantry starter suggestions.';

grant execute on function public.popular_ingredients(int, public.recipe_domain)
  to anon, authenticated;