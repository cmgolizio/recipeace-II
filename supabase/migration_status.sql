-- Which migrations does this database already have?
--
-- Read-only, safe to run any time. Paste into the Supabase SQL Editor: every
-- row with applied = false is a file under supabase/migrations/ you still
-- need to run, and the step column is the order to run them in.
--
-- Why this exists: migrations are applied to hosted projects by hand here (no
-- linked CLI), so the repository cannot know what a given project has. This
-- asks the database instead. See docs/expansion-rollout.md §9.
select * from (values
  (' 1', '20260727120000_related_recipes',
   to_regprocedure('public.related_recipes(bigint,int)') is not null),
  (' 2', '20260728120000_ingredient_slugs',
   to_regprocedure('public.slugify(text)') is not null),
  (' 3', '20260728120100_ingredient_detail',
   to_regprocedure('public.ingredient_detail(text)') is not null
   or to_regprocedure('public.ingredient_detail(text,public.recipe_domain)') is not null),
  (' 4', '20260801120000_recipe_domain',
   exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='recipes' and column_name='domain')),
  (' 5', '20260801120100_domain_aware_recipe_queries',
   to_regprocedure('public.ingredient_detail(text,public.recipe_domain)') is not null),
  (' 6', '20260801120200_match_recipes_domain',
   to_regprocedure('public.match_recipes(bigint[],int,public.recipe_domain)') is not null),
  (' 7', '20260802120000_recipe_detail_tables',
   to_regclass('public.cocktail_recipe_details') is not null),
  (' 8', '20260802120100_functions_read_recipe_details',
   coalesce(position('cocktail_recipe_details' in
     pg_get_functiondef(to_regprocedure('public.related_recipes(bigint,int)'))) > 0, false)),
  (' 9', '20260803120000_food_ingredient_categories',
   exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
           where t.typname='ingredient_category' and e.enumlabel='baking')),
  ('10', '20260804120000_recipe_ingredients_food_ready',
   exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='recipe_ingredients' and column_name='section')),
  ('11', '20260805120000_recipe_source_provenance',
   exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='recipes' and column_name='license')),
  ('12', '20260806120000_search_recipes',
   to_regprocedure('public.search_recipes(text,public.recipe_domain,int)') is not null)
) as t(step, migration, applied)
order by step;