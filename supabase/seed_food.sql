-- Food catalog (GENERATED — do not edit by hand).
-- Source of truth: src/data/food-seed.ts   ·   Regenerate: npm run pipeline:food
--
-- Idempotent: every statement upserts on a natural key, so re-running it
-- changes nothing. Apply AFTER the migrations and supabase/seed.sql.

-- Guard: a food recipe must never overwrite a drink that happens to
-- share its slug (both live in one table, and slugs are one namespace).
do $$
declare
  clash text;
begin
  select string_agg(slug, ', ') into clash
  from public.recipes
  where slug = any(array['soft-scrambled-eggs-on-toast','overnight-oats','banana-pancakes','grilled-cheese-sandwich','cucumber-tomato-salad','lemon-vinaigrette','garlic-butter-spaghetti','spaghetti-with-tomato-sauce','chicken-fried-rice','lentil-soup','sheet-pan-chicken-and-potatoes','black-bean-tacos','chocolate-chip-cookies']) and domain <> 'food';
  if clash is not null then
    raise exception 'food catalog slug(s) already used by another domain: %', clash;
  end if;
end;
$$;

begin;

-- Canonical ingredients. Existing rows keep their id, slug and category.
insert into public.ingredients (name, slug, category, is_staple) values
  ('onion', 'onion', 'produce', false),
  ('red onion', 'red-onion', 'produce', false),
  ('green onion', 'green-onion', 'produce', false),
  ('garlic', 'garlic', 'produce', false),
  ('tomato', 'tomato', 'produce', false),
  ('carrot', 'carrot', 'produce', false),
  ('celery', 'celery', 'produce', false),
  ('potato', 'potato', 'produce', false),
  ('banana', 'banana', 'produce', false),
  ('frozen peas', 'frozen-peas', 'produce', false),
  ('flat-leaf parsley', 'flat-leaf-parsley', 'herb', false),
  ('cilantro', 'cilantro', 'herb', false),
  ('black pepper', 'black-pepper', 'spice', false),
  ('ground cumin', 'ground-cumin', 'spice', false),
  ('red pepper flakes', 'red-pepper-flakes', 'spice', false),
  ('ground cinnamon', 'ground-cinnamon', 'spice', false),
  ('dried oregano', 'dried-oregano', 'spice', false),
  ('butter', 'butter', 'dairy', false),
  ('cheddar cheese', 'cheddar-cheese', 'dairy', false),
  ('parmesan cheese', 'parmesan-cheese', 'dairy', false),
  ('feta cheese', 'feta-cheese', 'dairy', false),
  ('olive oil', 'olive-oil', 'oil_and_fat', false),
  ('vegetable oil', 'vegetable-oil', 'oil_and_fat', false),
  ('sesame oil', 'sesame-oil', 'oil_and_fat', false),
  ('all-purpose flour', 'all-purpose-flour', 'baking', false),
  ('baking soda', 'baking-soda', 'baking', false),
  ('baking powder', 'baking-powder', 'baking', false),
  ('vanilla extract', 'vanilla-extract', 'baking', false),
  ('chocolate chips', 'chocolate-chips', 'baking', false),
  ('brown sugar', 'brown-sugar', 'baking', false),
  ('honey', 'honey', 'sweetener', false),
  ('rolled oats', 'rolled-oats', 'grain', false),
  ('white rice', 'white-rice', 'grain', false),
  ('spaghetti', 'spaghetti', 'pasta', false),
  ('sliced bread', 'sliced-bread', 'bread', false),
  ('corn tortilla', 'corn-tortilla', 'bread', false),
  ('brown lentils', 'brown-lentils', 'legume', false),
  ('black beans', 'black-beans', 'legume', false),
  ('canned crushed tomatoes', 'canned-crushed-tomatoes', 'canned_good', false),
  ('vegetable stock', 'vegetable-stock', 'canned_good', false),
  ('dijon mustard', 'dijon-mustard', 'condiment', false),
  ('soy sauce', 'soy-sauce', 'condiment', false),
  ('chicken breast', 'chicken-breast', 'meat', false),
  ('chicken thigh', 'chicken-thigh', 'meat', false)
on conflict (name) do nothing;

update public.ingredients child set parent_id = parent.id
from (values
  ('red onion', 'onion')
) as v(child_name, parent_name)
join public.ingredients parent on parent.name = v.parent_name
where child.name = v.child_name;

insert into public.ingredient_aliases (alias, ingredient_id)
select v.alias, i.id from (values
  ('scallions', 'green onion'),
  ('spring onion', 'green onion'),
  ('coriander leaves', 'cilantro'),
  ('fresh coriander', 'cilantro'),
  ('italian parsley', 'flat-leaf parsley'),
  ('yellow onion', 'onion'),
  ('brown onion', 'onion'),
  ('plain flour', 'all-purpose flour'),
  ('bicarbonate of soda', 'baking soda'),
  ('chilli flakes', 'red pepper flakes'),
  ('crushed red pepper', 'red pepper flakes'),
  ('porridge oats', 'rolled oats'),
  ('old-fashioned oats', 'rolled oats'),
  ('extra virgin olive oil', 'olive oil'),
  ('unsalted butter', 'butter'),
  ('salted butter', 'butter'),
  ('parmigiano reggiano', 'parmesan cheese'),
  ('freshly ground black pepper', 'black pepper'),
  ('tinned tomatoes', 'canned crushed tomatoes'),
  ('veg stock', 'vegetable stock')
) as v(alias, ingredient_name)
join public.ingredients i on i.name = v.ingredient_name
on conflict (alias) do nothing;

-- Soft Scrambled Eggs on Toast
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'soft-scrambled-eggs-on-toast', 'Soft Scrambled Eggs on Toast', 'food', 'Eggs cooked low and slow until they set into soft curds, on buttered toast.',
  array['Beat the egg with the milk and a pinch of salt until no streaks of white remain.','Melt half the butter in a non-stick pan over low heat.','Add the egg and stir slowly and constantly, scraping the base of the pan.','Take the pan off the heat while the curds still look slightly underdone — they carry on setting.','Toast the bread, spread it with the remaining butter, and pile the egg on top.','Finish with black pepper.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 3, 7,
       10, 2,
       'breakfast', 'american'
from public.recipes where slug = 'soft-scrambled-eggs-on-toast'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'soft-scrambled-eggs-on-toast');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('whole egg', 4, 'each', null, false, 1, null, '4 each whole egg'),
  ('milk', 2, 'tbsp', null, false, 2, null, '2 tbsp milk'),
  ('butter', 1, 'tbsp', 'divided', false, 3, null, '1 tbsp butter'),
  ('sliced bread', 2, 'slice', null, false, 4, null, '2 slice sliced bread'),
  ('butter', 1, 'tbsp', 'divided, for the toast', false, 5, null, '1 tbsp butter'),
  ('salt', null, null, 'to taste', true, 6, null, 'salt'),
  ('black pepper', null, null, 'to taste', true, 7, null, 'black pepper')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'soft-scrambled-eggs-on-toast'
join public.ingredients i on i.name = v.ingredient_name;

-- Overnight Oats
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'overnight-oats', 'Overnight Oats', 'food', 'Oats soaked in milk overnight, sweetened with honey and finished with berries.',
  array['Stir the rolled oats, milk, honey and cinnamon together in a jar or bowl.','Cover and refrigerate for at least six hours, or overnight.','Stir once before serving; loosen with a splash more milk if it has set firm.','Top with the strawberry.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 5, 0,
       5, 2,
       'breakfast', 'american'
from public.recipes where slug = 'overnight-oats'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'overnight-oats');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('rolled oats', 1, 'cup', null, false, 1, null, '1 cup rolled oats'),
  ('milk', 1, 'cup', null, false, 2, null, '1 cup milk'),
  ('honey', 2, 'tbsp', null, false, 3, null, '2 tbsp honey'),
  ('ground cinnamon', 0.5, 'tsp', null, true, 4, null, '0.5 tsp ground cinnamon'),
  ('strawberry', 1, 'cup', 'hulled and halved', true, 5, null, '1 cup strawberry')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'overnight-oats'
join public.ingredients i on i.name = v.ingredient_name;

-- Banana Pancakes
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'banana-pancakes', 'Banana Pancakes', 'food', 'A thick batter with mashed banana stirred through, cooked in butter.',
  array['Mash the banana in a large bowl until nearly smooth.','Whisk in the milk, egg and melted butter.','Add the flour, sugar, baking powder and salt, and stir just until combined — a few lumps are fine.','Cook ladles of batter in a buttered pan over medium heat until bubbles form and the edges set, about two minutes.','Flip and cook for another minute, until golden.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 10, 10,
       20, 4,
       'breakfast', 'american'
from public.recipes where slug = 'banana-pancakes'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'banana-pancakes');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('banana', 2, 'each', 'very ripe', false, 1, null, '2 each banana'),
  ('milk', 1, 'cup', null, false, 2, null, '1 cup milk'),
  ('whole egg', 1, 'each', null, false, 3, null, '1 each whole egg'),
  ('butter', 2, 'tbsp', 'melted, divided', false, 4, null, '2 tbsp butter'),
  ('all-purpose flour', 1.5, 'cup', null, false, 5, null, '1.5 cup all-purpose flour'),
  ('sugar', 2, 'tbsp', null, false, 6, null, '2 tbsp sugar'),
  ('baking powder', 2, 'tsp', null, false, 7, null, '2 tsp baking powder'),
  ('salt', 0.5, 'tsp', null, false, 8, null, '0.5 tsp salt'),
  ('butter', 1, 'tbsp', 'divided, for the pan', false, 9, null, '1 tbsp butter')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'banana-pancakes'
join public.ingredients i on i.name = v.ingredient_name;

-- Grilled Cheese Sandwich
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'grilled-cheese-sandwich', 'Grilled Cheese Sandwich', 'food', 'Cheddar between buttered bread, pressed in a pan until molten.',
  array['Butter one side of each slice of bread.','Lay one slice butter-side down in a cold pan, cover with the cheddar cheese, and top with the second slice, butter-side up.','Cook over medium-low heat until the underside is deep gold, about four minutes.','Flip and cook until the second side matches and the cheese has melted through.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 3, 7,
       10, 1,
       'sandwich', 'american'
from public.recipes where slug = 'grilled-cheese-sandwich'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'grilled-cheese-sandwich');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('sliced bread', 2, 'slice', null, false, 1, null, '2 slice sliced bread'),
  ('cheddar cheese', 2, 'oz', 'sliced or grated', false, 2, null, '2 oz cheddar cheese'),
  ('butter', 1, 'tbsp', 'softened', false, 3, null, '1 tbsp butter')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'grilled-cheese-sandwich'
join public.ingredients i on i.name = v.ingredient_name;

-- Cucumber Tomato Salad
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'cucumber-tomato-salad', 'Cucumber Tomato Salad', 'food', 'Cucumber, tomato and red onion dressed with lemon and olive oil.',
  array['Cut the cucumber and tomato into rough chunks and slice the red onion thin.','Salt the vegetables lightly and leave them for five minutes.','Whisk the olive oil and lemon juice together with a grind of black pepper, and pour it over.','Toss, then scatter the feta cheese and mint on top.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 10, 0,
       10, 4,
       'salad', 'mediterranean'
from public.recipes where slug = 'cucumber-tomato-salad'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'cucumber-tomato-salad');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('cucumber', 1, 'each', null, false, 1, null, '1 each cucumber'),
  ('tomato', 3, 'each', null, false, 2, null, '3 each tomato'),
  ('red onion', 0.5, 'each', null, false, 3, null, '0.5 each red onion'),
  ('olive oil', 3, 'tbsp', null, false, 4, null, '3 tbsp olive oil'),
  ('lemon juice', 2, 'tbsp', null, false, 5, null, '2 tbsp lemon juice'),
  ('salt', null, null, 'to taste', true, 6, null, 'salt'),
  ('black pepper', null, null, 'to taste', true, 7, null, 'black pepper'),
  ('feta cheese', 3, 'oz', 'crumbled', true, 8, null, '3 oz feta cheese'),
  ('fresh mint', 8, 'leaves', 'torn', true, 9, null, '8 leaves fresh mint')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'cucumber-tomato-salad'
join public.ingredients i on i.name = v.ingredient_name;

-- Lemon Vinaigrette
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'lemon-vinaigrette', 'Lemon Vinaigrette', 'food', 'A sharp everyday dressing that keeps for a week in the fridge.',
  array['Whisk the lemon juice, dijon mustard, honey, salt and pepper together in a bowl.','Pour the olive oil in slowly, whisking, until the dressing thickens and stops separating.','Taste and adjust with more lemon juice or salt.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 5, 0,
       5, 6,
       'sauce', 'french'
from public.recipes where slug = 'lemon-vinaigrette'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'lemon-vinaigrette');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('lemon juice', 3, 'tbsp', null, false, 1, null, '3 tbsp lemon juice'),
  ('dijon mustard', 1, 'tsp', null, false, 2, null, '1 tsp dijon mustard'),
  ('honey', 1, 'tsp', null, false, 3, null, '1 tsp honey'),
  ('olive oil', 0.5, 'cup', null, false, 4, null, '0.5 cup olive oil'),
  ('salt', null, null, 'to taste', true, 5, null, 'salt'),
  ('black pepper', null, null, 'to taste', true, 6, null, 'black pepper')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'lemon-vinaigrette'
join public.ingredients i on i.name = v.ingredient_name;

-- Garlic Butter Spaghetti
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'garlic-butter-spaghetti', 'Garlic Butter Spaghetti', 'food', 'Spaghetti tossed with garlic softened in butter and olive oil, finished with parmesan.',
  array['Boil the spaghetti in well-salted water until just tender, then reserve a cup of the cooking water and drain.','While it cooks, warm the olive oil and butter in a wide pan over low heat.','Add the sliced garlic and the red pepper flakes and cook gently until the garlic is pale gold — do not let it brown.','Add the drained spaghetti to the pan with a splash of the cooking water and toss hard until the sauce clings.','Take it off the heat, stir through the parmesan cheese and parsley, and season with salt.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 5, 15,
       20, 2,
       'main', 'italian'
from public.recipes where slug = 'garlic-butter-spaghetti'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'garlic-butter-spaghetti');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('spaghetti', 200, 'g', null, false, 1, null, '200 g spaghetti'),
  ('olive oil', 3, 'tbsp', null, false, 2, null, '3 tbsp olive oil'),
  ('butter', 2, 'tbsp', null, false, 3, null, '2 tbsp butter'),
  ('garlic', 4, 'clove', 'thinly sliced', false, 4, null, '4 clove garlic'),
  ('red pepper flakes', 0.5, 'tsp', null, true, 5, null, '0.5 tsp red pepper flakes'),
  ('parmesan cheese', 1, 'oz', 'finely grated', false, 6, null, '1 oz parmesan cheese'),
  ('flat-leaf parsley', 2, 'tbsp', 'chopped', true, 7, null, '2 tbsp flat-leaf parsley'),
  ('salt', null, null, 'to taste', true, 8, null, 'salt')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'garlic-butter-spaghetti'
join public.ingredients i on i.name = v.ingredient_name;

-- Spaghetti with Tomato Sauce
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'spaghetti-with-tomato-sauce', 'Spaghetti with Tomato Sauce', 'food', 'A slow-simmered tinned tomato sauce, seasoned with basil and a pinch of sugar.',
  array['Warm half the olive oil in a saucepan and cook the onion gently until soft and translucent, about eight minutes.','Add the garlic and cook for another minute.','Tip in the canned crushed tomatoes, add the sugar and a good pinch of salt, and simmer uncovered for twenty-five minutes, stirring now and then.','Boil the spaghetti in well-salted water until just tender, and drain.','Stir the remaining olive oil and the torn basil into the sauce, then toss it with the pasta.','Serve with parmesan cheese.'], 'medium'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 10, 35,
       45, 4,
       'main', 'italian'
from public.recipes where slug = 'spaghetti-with-tomato-sauce'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'spaghetti-with-tomato-sauce');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('olive oil', 3, 'tbsp', 'divided', false, 1, 'For the sauce', '3 tbsp olive oil'),
  ('onion', 1, 'each', 'finely chopped', false, 2, 'For the sauce', '1 each onion'),
  ('garlic', 3, 'clove', 'chopped', false, 3, 'For the sauce', '3 clove garlic'),
  ('canned crushed tomatoes', 800, 'g', null, false, 4, 'For the sauce', '800 g canned crushed tomatoes'),
  ('sugar', 1, 'tsp', null, false, 5, 'For the sauce', '1 tsp sugar'),
  ('fresh basil', 10, 'leaves', 'torn', false, 6, 'For the sauce', '10 leaves fresh basil'),
  ('salt', null, null, 'to taste', true, 7, 'For the sauce', 'salt'),
  ('spaghetti', 400, 'g', null, false, 8, 'To serve', '400 g spaghetti'),
  ('parmesan cheese', 2, 'oz', 'grated', true, 9, 'To serve', '2 oz parmesan cheese')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'spaghetti-with-tomato-sauce'
join public.ingredients i on i.name = v.ingredient_name;

-- Chicken Fried Rice
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'chicken-fried-rice', 'Chicken Fried Rice', 'food', 'Cold rice fried hard with chicken, egg and peas, seasoned with soy and sesame.',
  array['Cook the white rice ahead and chill it — day-old rice fries far better than fresh.','Heat half the vegetable oil in a wok or large pan until it shimmers, and cook the diced chicken breast until browned and cooked through. Set it aside.','Add the remaining oil, then the garlic and the white parts of the green onion, and stir for thirty seconds.','Push everything to one side, pour in the beaten egg, and scramble it quickly.','Add the rice and the frozen peas and fry hard, breaking up any clumps, until the grains separate and start to catch.','Return the chicken, add the soy sauce and sesame oil, and toss to coat.','Finish with the green tops of the onion.'], 'medium'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 15, 15,
       30, 4,
       'main', 'chinese'
from public.recipes where slug = 'chicken-fried-rice'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'chicken-fried-rice');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('white rice', 3, 'cup', 'cooked and chilled', false, 1, null, '3 cup white rice'),
  ('chicken breast', 1, 'lb', 'diced', false, 2, null, '1 lb chicken breast'),
  ('vegetable oil', 2, 'tbsp', 'divided', false, 3, null, '2 tbsp vegetable oil'),
  ('garlic', 2, 'clove', 'chopped', false, 4, null, '2 clove garlic'),
  ('green onion', 4, 'each', 'sliced, white and green parts kept apart', false, 5, null, '4 each green onion'),
  ('whole egg', 2, 'each', 'beaten', false, 6, null, '2 each whole egg'),
  ('frozen peas', 1, 'cup', null, false, 7, null, '1 cup frozen peas'),
  ('soy sauce', 3, 'tbsp', null, false, 8, null, '3 tbsp soy sauce'),
  ('sesame oil', 1, 'tsp', null, false, 9, null, '1 tsp sesame oil')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'chicken-fried-rice'
join public.ingredients i on i.name = v.ingredient_name;

-- Lentil Soup
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'lentil-soup', 'Lentil Soup', 'food', 'Brown lentils simmered with a soffritto of onion, carrot and celery.',
  array['Warm the olive oil in a heavy pot and cook the onion, carrot and celery over medium-low heat until soft, about ten minutes.','Add the garlic and ground cumin and cook for a minute, until fragrant.','Stir in the brown lentils, canned crushed tomatoes and vegetable stock.','Bring to a boil, then reduce to a simmer and cook until the lentils are tender, thirty to forty minutes.','Season with salt and black pepper, and finish with the lemon juice — it lifts the whole pot.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 15, 40,
       55, 4,
       'soup', 'mediterranean'
from public.recipes where slug = 'lentil-soup'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'lentil-soup');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('olive oil', 2, 'tbsp', null, false, 1, null, '2 tbsp olive oil'),
  ('onion', 1, 'each', 'chopped', false, 2, null, '1 each onion'),
  ('carrot', 2, 'each', 'chopped', false, 3, null, '2 each carrot'),
  ('celery', 2, 'each', 'chopped', false, 4, null, '2 each celery'),
  ('garlic', 3, 'clove', 'chopped', false, 5, null, '3 clove garlic'),
  ('ground cumin', 1, 'tsp', null, false, 6, null, '1 tsp ground cumin'),
  ('brown lentils', 1.5, 'cup', 'rinsed', false, 7, null, '1.5 cup brown lentils'),
  ('canned crushed tomatoes', 400, 'g', null, false, 8, null, '400 g canned crushed tomatoes'),
  ('vegetable stock', 6, 'cup', null, false, 9, null, '6 cup vegetable stock'),
  ('lemon juice', 2, 'tbsp', null, false, 10, null, '2 tbsp lemon juice'),
  ('salt', null, null, 'to taste', true, 11, null, 'salt'),
  ('black pepper', null, null, 'to taste', true, 12, null, 'black pepper')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'lentil-soup'
join public.ingredients i on i.name = v.ingredient_name;

-- Sheet-Pan Chicken and Potatoes
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'sheet-pan-chicken-and-potatoes', 'Sheet-Pan Chicken and Potatoes', 'food', 'Chicken thighs and potatoes roasted together until the skin crisps and the potatoes take on the fat.',
  array['Heat the oven to 425°F (220°C).','Toss the potato and carrot with half the olive oil, the dried oregano, salt and black pepper, and spread them on a sheet pan.','Rub the chicken thigh pieces with the remaining oil and the garlic, season them well, and set them on top, skin side up.','Roast for forty to forty-five minutes, until the chicken is cooked through and the potatoes are browned at the edges.','Squeeze the lemon over everything before serving.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 15, 45,
       60, 4,
       'main', 'mediterranean'
from public.recipes where slug = 'sheet-pan-chicken-and-potatoes'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'sheet-pan-chicken-and-potatoes');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('chicken thigh', 8, 'each', 'bone-in, skin-on', false, 1, null, '8 each chicken thigh'),
  ('potato', 1.5, 'lb', 'cut into chunks', false, 2, null, '1.5 lb potato'),
  ('carrot', 3, 'each', 'cut into batons', false, 3, null, '3 each carrot'),
  ('olive oil', 4, 'tbsp', 'divided', false, 4, null, '4 tbsp olive oil'),
  ('garlic', 4, 'clove', 'crushed', false, 5, null, '4 clove garlic'),
  ('dried oregano', 2, 'tsp', null, false, 6, null, '2 tsp dried oregano'),
  ('lemon', 1, 'each', 'halved', false, 7, null, '1 each lemon'),
  ('salt', null, null, 'to taste', true, 8, null, 'salt'),
  ('black pepper', null, null, 'to taste', true, 9, null, 'black pepper')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'sheet-pan-chicken-and-potatoes'
join public.ingredients i on i.name = v.ingredient_name;

-- Black Bean Tacos
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'black-bean-tacos', 'Black Bean Tacos', 'food', 'Cumin-spiced black beans in warm tortillas, with red onion and lime.',
  array['Warm the olive oil in a pan and cook the red onion until it softens.','Add the ground cumin and cook for thirty seconds, then tip in the black beans with a splash of water.','Mash about half the beans against the side of the pan and simmer until thick.','Season with salt and half the lime juice.','Warm the corn tortilla in a dry pan until pliable and blistered in spots.','Fill them with the beans, then finish with cilantro, cheddar cheese, hot sauce and the remaining lime juice.'], 'easy'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 10, 10,
       20, 4,
       'main', 'mexican'
from public.recipes where slug = 'black-bean-tacos'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'black-bean-tacos');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('olive oil', 1, 'tbsp', null, false, 1, 'For the beans', '1 tbsp olive oil'),
  ('red onion', 0.5, 'each', 'finely chopped', false, 2, 'For the beans', '0.5 each red onion'),
  ('ground cumin', 1, 'tsp', null, false, 3, 'For the beans', '1 tsp ground cumin'),
  ('black beans', 800, 'g', 'drained and rinsed', false, 4, 'For the beans', '800 g black beans'),
  ('lime juice', 2, 'tbsp', 'divided', false, 5, 'For the beans', '2 tbsp lime juice'),
  ('salt', null, null, 'to taste', true, 6, 'For the beans', 'salt'),
  ('corn tortilla', 8, 'each', null, false, 7, 'To serve', '8 each corn tortilla'),
  ('cilantro', 3, 'tbsp', 'chopped', true, 8, 'To serve', '3 tbsp cilantro'),
  ('cheddar cheese', 2, 'oz', 'grated', true, 9, 'To serve', '2 oz cheddar cheese'),
  ('hot sauce', null, null, 'to taste', true, 10, 'To serve', 'hot sauce')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'black-bean-tacos'
join public.ingredients i on i.name = v.ingredient_name;

-- Chocolate Chip Cookies
insert into public.recipes
  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)
values (
  'chocolate-chip-cookies', 'Chocolate Chip Cookies', 'food', 'Chewy in the middle, crisp at the edge, from a creamed butter-and-sugar dough.',
  array['Heat the oven to 350°F (175°C) and line two baking sheets.','Beat the softened butter with the brown sugar and sugar until pale and fluffy, about three minutes.','Beat in the egg and vanilla extract.','Stir the flour, baking soda and salt together, then fold them in until no dry flour remains.','Fold through the chocolate chips.','Drop rounded tablespoons onto the sheets, leaving room to spread.','Bake for ten to twelve minutes, until the edges are set and the centres still look soft. They firm up as they cool.'], 'medium'::public.recipe_difficulty,
  'original', null, 'original', true
)
on conflict (slug) do update set
  name = excluded.name, domain = excluded.domain,
  description = excluded.description, instructions = excluded.instructions,
  difficulty = excluded.difficulty, source = excluded.source,
  source_url = excluded.source_url, license = excluded.license,
  is_published = excluded.is_published;

insert into public.food_recipe_details
  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)
select id, 20, 12,
       32, 24,
       'dessert', 'american'
from public.recipes where slug = 'chocolate-chip-cookies'
on conflict (recipe_id) do update set
  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes, servings = excluded.servings,
  course = excluded.course, cuisine = excluded.cuisine;

-- Replaced wholesale: a shortened ingredient list must not leave orphans.
delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = 'chocolate-chip-cookies');
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)
select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,
       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text
from (values
  ('butter', 8, 'oz', 'softened', false, 1, null, '8 oz butter'),
  ('brown sugar', 1, 'cup', 'packed', false, 2, null, '1 cup brown sugar'),
  ('sugar', 0.5, 'cup', null, false, 3, null, '0.5 cup sugar'),
  ('whole egg', 1, 'each', null, false, 4, null, '1 each whole egg'),
  ('vanilla extract', 2, 'tsp', null, false, 5, null, '2 tsp vanilla extract'),
  ('all-purpose flour', 2.25, 'cup', null, false, 6, null, '2.25 cup all-purpose flour'),
  ('baking soda', 1, 'tsp', null, false, 7, null, '1 tsp baking soda'),
  ('salt', 0.5, 'tsp', null, false, 8, null, '0.5 tsp salt'),
  ('chocolate chips', 2, 'cup', null, false, 9, null, '2 cup chocolate chips')
) as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)
join public.recipes r on r.slug = 'chocolate-chip-cookies'
join public.ingredients i on i.name = v.ingredient_name;

commit;
