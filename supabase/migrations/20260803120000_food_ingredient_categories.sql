-- Food categories for the shared ingredient catalog (docs/expansion-plan.md
-- §31, phase 6).
--
-- TAXONOMY RULES
--
--   1. One catalog. Food and cocktails share `ingredients`; nothing here is
--      domain-owned. Lime juice is one row used by a daiquiri and a marinade
--      (Decision 7, plan §31 "Key Constraint").
--   2. `category` answers "what kind of thing is this?" — a display and
--      grouping bucket for the pantry browser and, later, the shopping list.
--      It is not a recipe concept and the matcher never reads it.
--   3. `is_staple` is a separate question — "does matching assume you own
--      this?" — answered by the phase 3 staple policy, not by the category.
--      The two are independent: flour is `baking` and NOT a staple.
--   4. `parent_id` is the is-a hierarchy the matcher walks (bourbon → whiskey).
--      Categories are flat and play no part in it.
--   5. One category per ingredient. Multi-category support waits until a
--      surface actually needs it (plan §8.6).
--
-- WHY AN ENUM, STILL. The plan offers a lookup table as an option. An enum
-- stays the simplest model that meets the requirement: the taxonomy is a fixed
-- product vocabulary, not user data, and no surface needs per-category
-- metadata yet — display order lives in the pantry browser and labels are the
-- value with underscores replaced. The trade-off is that a new category needs
-- a migration. Revisit if categories start carrying data of their own (a
-- shopping-list aisle, an icon, a translated label).
--
-- The existing cocktail values are untouched, so every seeded ingredient keeps
-- its id, slug and category. `alter type … add value` may not be *used* in the
-- transaction that adds it, so this migration only adds — the first rows using
-- these values arrive with the phase 9 food seed.

alter type public.ingredient_category add value if not exists 'meat';
alter type public.ingredient_category add value if not exists 'seafood';
alter type public.ingredient_category add value if not exists 'egg';
alter type public.ingredient_category add value if not exists 'grain';
alter type public.ingredient_category add value if not exists 'pasta';
alter type public.ingredient_category add value if not exists 'bread';
alter type public.ingredient_category add value if not exists 'legume';
alter type public.ingredient_category add value if not exists 'canned_good';
alter type public.ingredient_category add value if not exists 'oil_and_fat';
alter type public.ingredient_category add value if not exists 'herb';
alter type public.ingredient_category add value if not exists 'spice';
alter type public.ingredient_category add value if not exists 'condiment';
alter type public.ingredient_category add value if not exists 'sauce';
alter type public.ingredient_category add value if not exists 'baking';
alter type public.ingredient_category add value if not exists 'sweetener';

comment on column public.ingredients.category is
  'Display and grouping bucket — what kind of ingredient this is. Shared '
  'across domains: an ingredient is never filed by the recipes that use it. '
  'Independent of is_staple (matching assumption) and parent_id (is-a '
  'hierarchy).';