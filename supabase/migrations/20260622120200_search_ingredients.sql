-- search_ingredients — trigram-ranked autocomplete over ingredient names AND
-- their aliases, so "midori" finds "melon liqueur", "kahlua" finds "coffee
-- liqueur", and typos still match. Backed by the pg_trgm GIN indexes on
-- ingredients.name and ingredient_aliases.alias.

create or replace function public.search_ingredients(q text, max_results int default 10)
returns table (
  id            bigint,
  name          text,
  category      public.ingredient_category,
  is_staple     boolean,
  matched_alias text,
  score         real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select id, name, category, is_staple, matched_alias, score
  from (
    select
      i.id, i.name, i.category, i.is_staple,
      -- Surface the alias that drove the match, if any (e.g. "midori").
      (array_agg(a.alias order by extensions.similarity(a.alias, q) desc)
         filter (where a.alias is not null and a.alias ilike '%' || q || '%'))[1]
        as matched_alias,
      greatest(
        extensions.similarity(i.name, q),
        coalesce(max(extensions.similarity(a.alias, q)), 0)
      ) as score
    from public.ingredients i
    left join public.ingredient_aliases a on a.ingredient_id = i.id
    where length(btrim(q)) > 0
      and (
        i.name ilike '%' || q || '%'
        or a.alias ilike '%' || q || '%'
        or extensions.similarity(i.name, q) > 0.2
        or extensions.similarity(a.alias, q) > 0.2
      )
    group by i.id, i.name, i.category, i.is_staple
  ) scored
  order by score desc, name asc
  limit greatest(1, least(coalesce(max_results, 10), 50));
$$;

comment on function public.search_ingredients(text, int) is
  'Trigram-ranked ingredient autocomplete over names and aliases. Returns the '
  'best-matching alias when an alias drove the match (e.g. "midori" -> melon liqueur).';

grant execute on function public.search_ingredients(text, int) to anon, authenticated;