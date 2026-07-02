-- TEMPORARY development data — a handful of classic cocktails so the /matches
-- view has something to render before the phase-8 generation pipeline exists.
-- Built entirely from seeded ingredients. Idempotent (upserts on slug and on
-- the recipe_ingredients (recipe_id, ingredient_id) unique key). Run AFTER the
-- migrations and seed.sql. Safe to delete/replace once real recipes are generated.

begin;

insert into public.recipes (slug, name, method, glass, garnish, instructions, description, is_published) values
('daiquiri','Daiquiri','shaken','coupe','Lime wheel',
  array['Add rum, lime juice, and simple syrup to a shaker with ice.','Shake until well-chilled.','Strain into a chilled coupe.'],
  'The benchmark rum sour: bright, balanced, three ingredients.', true),
('margarita','Margarita','shaken','rocks','Salt rim, lime wedge',
  array['Rim a rocks glass with salt (optional).','Shake tequila, lime juice, and triple sec with ice.','Strain over fresh ice.'],
  'Tequila, lime, and orange liqueur — tart and refreshing.', true),
('old-fashioned','Old Fashioned','stirred','rocks','Orange twist',
  array['Stir bourbon, syrup, and bitters with ice.','Strain over a large cube.','Express an orange twist over the top.'],
  'The original cocktail: spirit, sugar, bitters.', true),
('negroni','Negroni','stirred','rocks','Orange twist',
  array['Stir gin, Campari, and sweet vermouth with ice.','Strain over fresh ice.','Garnish with an orange twist.'],
  'Equal parts gin, Campari, and sweet vermouth.', true),
('whiskey-sour','Whiskey Sour','shaken','rocks','Angostura bitters',
  array['Dry-shake bourbon, lemon, syrup, and egg white.','Add ice and shake again.','Strain over fresh ice and dot with bitters.'],
  'A creamy, balanced bourbon sour.', true),
('mojito','Mojito','built','highball','Mint sprig',
  array['Gently muddle mint with lime juice and syrup.','Add rum and ice, stir.','Top with soda water.'],
  'Rum, lime, mint, and soda — long and refreshing.', true),
('manhattan','Manhattan','stirred','coupe','Luxardo cherry',
  array['Stir rye, sweet vermouth, and bitters with ice.','Strain into a chilled coupe.','Garnish with a cherry.'],
  'Rye whiskey and sweet vermouth, perfumed with bitters.', true),
('cosmopolitan','Cosmopolitan','shaken','coupe','Lime wheel',
  array['Shake vodka, Cointreau, lime, and cranberry with ice.','Strain into a chilled coupe.'],
  'Vodka, orange liqueur, lime, and cranberry.', true),
('aperol-spritz','Aperol Spritz','built','wine glass','Orange slice',
  array['Build Aperol, prosecco, and soda over ice in a wine glass.','Stir gently.','Garnish with an orange slice.'],
  'The classic low-ABV aperitivo spritz.', true),
('gin-and-tonic','Gin & Tonic','built','highball','Lime wedge',
  array['Build gin and tonic over ice.','Stir briefly.','Garnish with a lime wedge.'],
  'Crisp, bittersweet, and effervescent.', true)
on conflict (slug) do update set
  name = excluded.name, method = excluded.method, glass = excluded.glass,
  garnish = excluded.garnish, instructions = excluded.instructions,
  description = excluded.description, is_published = excluded.is_published;

insert into public.recipe_ingredients
  (recipe_id, ingredient_id, amount, unit, is_optional, is_garnish, display_order)
select r.id, i.id, v.amount::numeric, v.unit::text,
       v.is_optional::boolean, v.is_garnish::boolean, v.display_order::int
from (values
  ('daiquiri','white rum',2.0,'oz',false,false,1),
  ('daiquiri','lime juice',1.0,'oz',false,false,2),
  ('daiquiri','simple syrup',0.75,'oz',false,false,3),
  ('daiquiri','lime wheel',null,null,true,true,4),

  ('margarita','blanco tequila',2.0,'oz',false,false,1),
  ('margarita','lime juice',1.0,'oz',false,false,2),
  ('margarita','triple sec',0.75,'oz',false,false,3),
  ('margarita','salt rim',null,null,true,true,4),
  ('margarita','lime wedge',null,null,true,true,5),

  ('old-fashioned','bourbon',2.0,'oz',false,false,1),
  ('old-fashioned','simple syrup',0.25,'oz',false,false,2),
  ('old-fashioned','angostura bitters',2.0,'dash',false,false,3),
  ('old-fashioned','orange twist',null,null,true,true,4),

  ('negroni','gin',1.0,'oz',false,false,1),
  ('negroni','campari',1.0,'oz',false,false,2),
  ('negroni','sweet vermouth',1.0,'oz',false,false,3),
  ('negroni','orange twist',null,null,true,true,4),

  ('whiskey-sour','bourbon',2.0,'oz',false,false,1),
  ('whiskey-sour','lemon juice',0.75,'oz',false,false,2),
  ('whiskey-sour','simple syrup',0.75,'oz',false,false,3),
  ('whiskey-sour','egg white',1.0,'each',true,false,4),
  ('whiskey-sour','angostura bitters',2.0,'dash',true,true,5),

  ('mojito','white rum',2.0,'oz',false,false,1),
  ('mojito','lime juice',0.75,'oz',false,false,2),
  ('mojito','simple syrup',0.5,'oz',false,false,3),
  ('mojito','fresh mint',8.0,'leaves',false,false,4),
  ('mojito','soda water',2.0,'oz',false,false,5),
  ('mojito','mint sprig',null,null,true,true,6),

  ('manhattan','rye whiskey',2.0,'oz',false,false,1),
  ('manhattan','sweet vermouth',1.0,'oz',false,false,2),
  ('manhattan','angostura bitters',2.0,'dash',false,false,3),
  ('manhattan','luxardo cherry',null,null,true,true,4),

  ('cosmopolitan','vodka',1.5,'oz',false,false,1),
  ('cosmopolitan','cointreau',0.5,'oz',false,false,2),
  ('cosmopolitan','lime juice',0.5,'oz',false,false,3),
  ('cosmopolitan','cranberry juice',1.0,'oz',false,false,4),
  ('cosmopolitan','lime wheel',null,null,true,true,5),

  ('aperol-spritz','aperol',2.0,'oz',false,false,1),
  ('aperol-spritz','prosecco',3.0,'oz',false,false,2),
  ('aperol-spritz','soda water',1.0,'oz',false,false,3),
  ('aperol-spritz','orange slice',null,null,true,true,4),

  ('gin-and-tonic','gin',2.0,'oz',false,false,1),
  ('gin-and-tonic','tonic water',4.0,'oz',false,false,2),
  ('gin-and-tonic','lime wedge',null,null,true,true,3)
) as v(recipe_slug, ingredient_name, amount, unit, is_optional, is_garnish, display_order)
join public.recipes r on r.slug = v.recipe_slug
join public.ingredients i on i.name = v.ingredient_name
on conflict (recipe_id, ingredient_id) do update set
  amount = excluded.amount, unit = excluded.unit, is_optional = excluded.is_optional,
  is_garnish = excluded.is_garnish, display_order = excluded.display_order;

commit;