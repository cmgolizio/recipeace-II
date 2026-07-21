// Generates supabase/seed.sql from the canonical seed data in
// src/data/cocktail-seed.ts. Run with: npm run generate:seed
//
// The generated SQL is idempotent (upserts on natural keys) and resolves the
// ingredient hierarchy and substitution/alias name references to ids by name.

import {
  ingredients,
  aliases,
  substitutions,
  derivations,
} from "../src/data/cocktail-seed.ts";

const q = (s: string | null | undefined): string =>
  s == null ? "null" : `'${s.replace(/'/g, "''")}'`;

const join = (rows: string[]): string => rows.join(",\n");

const ingredientValues = join(
  ingredients.map(
    (i) => `  (${q(i.name)}, ${q(i.category)}, ${i.isStaple ? "true" : "false"})`,
  ),
);

const parentValues = join(
  ingredients
    .filter((i) => i.parent)
    .map((i) => `  (${q(i.name)}, ${q(i.parent)})`),
);

const aliasValues = join(
  aliases.map((a) => `  (${q(a.alias)}, ${q(a.ingredient)})`),
);

const substitutionValues = join(
  substitutions.map(
    (s) => `  (${q(s.ingredient)}, ${q(s.substitute)}, ${q(s.note)})`,
  ),
);

const derivationValues = join(
  derivations.map((d) => `  (${q(d.source)}, ${q(d.derived)})`),
);

const sql = `-- In House Mixers — reference data seed (GENERATED — do not edit by hand).
-- Source of truth: src/data/cocktail-seed.ts   ·   Regenerate: npm run generate:seed
--
-- Idempotent: upserts keyed on natural keys (ingredient name, alias, and
-- substitution pair), so it is safe to re-run. Paste into the Supabase SQL
-- Editor and run AFTER the migrations.

begin;

-- 1. Ingredients (parent_id is resolved by name in step 2).
insert into public.ingredients (name, category, is_staple) values
${ingredientValues}
on conflict (name) do update set
  category = excluded.category,
  is_staple = excluded.is_staple;

-- 2. Resolve the is-a hierarchy: map each child name to its parent's id.
update public.ingredients c
set parent_id = p.id
from (values
${parentValues}
) as m (child, parent)
join public.ingredients p on p.name = m.parent
where c.name = m.child;

-- 3. Aliases (brand / spelling variants -> canonical ingredient).
insert into public.ingredient_aliases (alias, ingredient_id)
select v.alias, i.id
from (values
${aliasValues}
) as v (alias, ingredient)
join public.ingredients i on i.name = v.ingredient
on conflict (alias) do update set ingredient_id = excluded.ingredient_id;

-- 4. Substitutions ("in a pinch" swaps).
insert into public.ingredient_substitutions (ingredient_id, substitute_id, note)
select i.id, s.id, v.note
from (values
${substitutionValues}
) as v (ingredient, substitute, note)
join public.ingredients i on i.name = v.ingredient
join public.ingredients s on s.name = v.substitute
on conflict (ingredient_id, substitute_id) do update set note = excluded.note;

-- 5. Derivations (owning the source physically yields the derived ingredient).
insert into public.ingredient_derivations (source_id, derived_id)
select s.id, d.id
from (values
${derivationValues}
) as v (source, derived)
join public.ingredients s on s.name = v.source
join public.ingredients d on d.name = v.derived
on conflict (source_id, derived_id) do nothing;

commit;
`;

process.stdout.write(sql);
process.stderr.write(
  `seed: ${ingredients.length} ingredients, ` +
    `${aliases.length} aliases, ${substitutions.length} substitutions, ` +
    `${derivations.length} derivations\n`,
);