// The food ingestion run (docs/expansion-plan.md §16): resolve, validate,
// deduplicate, report, emit. Pure — give it a catalog, get back a report and
// the SQL that would apply it. The CLI in scripts/pipeline/ingest-food.ts does
// the file I/O.
//
// WHY SQL, NOT ADMIN-CLIENT WRITES. Food content is curated and reviewed
// (Decision 12), which makes it reference data, and this repository already
// has a shape for reference data: a typed source in src/data compiled to an
// idempotent SQL file (see scripts/generate-seed-sql.ts). Emitting SQL keeps
// the whole path runnable and testable with no Supabase project, and
// idempotency comes from the same on-conflict clauses the existing seeds use.
// The generated file is applied exactly like supabase/seed.sql.

import {
  aliases as cocktailAliases,
  ingredients as cocktailIngredients,
} from "../../../../src/data/cocktail-seed.ts";
import type { IngestReport, RecipeReport } from "../../core/report.ts";
import type { ResolvedRecipe, Resolver } from "../../core/types.ts";
import { slugify } from "../../core/slug.ts";
import type { FoodCatalog } from "./source.ts";
import { validateFoodRecipe } from "./validate.ts";

export type IngestOptions = {
  /** Recipe slugs already in the database, to catch collisions. */
  existingSlugs?: string[];
  /** Recipe names already in the database, to catch near-duplicates. */
  existingNames?: string[];
};

export type IngestResult = {
  report: IngestReport;
  recipes: ResolvedRecipe[];
  /** Canonical ingredient name per resolved id, for the SQL emitter. */
  ingredientNames: Map<number, string>;
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The shared taxonomy as this run sees it: everything the cocktail seed
 * already has, plus what this catalog introduces. Ids are positional — they
 * only have to be stable within the run, because the emitted SQL resolves
 * ingredients by name the way every other seed in this repository does.
 */
function buildTaxonomy(catalog: FoodCatalog): {
  resolve: Resolver;
  names: Map<number, string>;
} {
  const names = new Map<number, string>();
  const byName = new Map<string, number>();

  const declare = (name: string) => {
    const key = normalizeName(name);
    let id = byName.get(key);
    if (id === undefined) {
      id = names.size + 1;
      names.set(id, name);
      byName.set(key, id);
    }
    return id;
  };

  for (const ingredient of cocktailIngredients) declare(ingredient.name);
  for (const ingredient of catalog.ingredients ?? []) declare(ingredient.name);
  for (const alias of [...cocktailAliases, ...(catalog.aliases ?? [])]) {
    const id = byName.get(normalizeName(alias.ingredient));
    if (id !== undefined) byName.set(normalizeName(alias.alias), id);
  }

  return { resolve: (name) => byName.get(normalizeName(name)) ?? null, names };
}

function describeLine(
  recipe: ResolvedRecipe,
  names: Map<number, string>,
  index: number,
): string {
  const line = recipe.ingredients[index];
  const parts = [
    line.amount != null ? String(line.amount) : null,
    line.unit,
    names.get(line.ingredient_id) ?? `#${line.ingredient_id}`,
  ].filter((p): p is string => !!p);
  const suffix = [
    line.preparation,
    line.is_optional ? "optional" : null,
    line.section,
  ]
    .filter((p): p is string => !!p)
    .join(", ");
  return suffix ? `${parts.join(" ")} — ${suffix}` : parts.join(" ");
}

/** Validate a whole catalog and describe exactly what applying it would do. */
export function ingestCatalog(
  catalog: FoodCatalog,
  options: IngestOptions = {},
): IngestResult {
  const { resolve, names } = buildTaxonomy(catalog);
  const knownIngredients = new Set(
    cocktailIngredients.map((i) => normalizeName(i.name)),
  );

  const accepted: RecipeReport[] = [];
  const rejected: { name: string; reason: string }[] = [];
  const recipes: ResolvedRecipe[] = [];
  const unresolved = new Set<string>();
  const duplicates: string[] = [];

  const seenSlugs = new Set(options.existingSlugs ?? []);
  const seenNames = new Map<string, string>();
  for (const name of options.existingNames ?? []) {
    seenNames.set(normalizeName(name), name);
  }

  for (const source of catalog.recipes) {
    const result = validateFoodRecipe(source, resolve);
    for (const name of result.unresolved) unresolved.add(name);
    if (result.status === "rejected") {
      rejected.push({ name: source.name ?? "(unnamed)", reason: result.reason });
      continue;
    }

    const { recipe } = result;
    // Idempotency rests on the slug, so a collision has to be caught here
    // rather than discovered as a silent overwrite (§8 migration risk 5).
    if (seenSlugs.has(recipe.slug)) {
      duplicates.push(`slug "${recipe.slug}" is already taken`);
      rejected.push({ name: recipe.name, reason: "duplicate slug" });
      continue;
    }
    const nameKey = normalizeName(recipe.name);
    const clash = seenNames.get(nameKey);
    if (clash !== undefined) {
      duplicates.push(`"${recipe.name}" looks like a duplicate of "${clash}"`);
      rejected.push({ name: recipe.name, reason: "duplicate recipe name" });
      continue;
    }

    seenSlugs.add(recipe.slug);
    seenNames.set(nameKey, recipe.name);
    recipes.push(recipe);
    accepted.push({
      name: recipe.name,
      slug: recipe.slug,
      domain: recipe.domain,
      published: recipe.is_published,
      lines: recipe.ingredients.map((_, i) => describeLine(recipe, names, i)),
      warnings: result.warnings,
    });
  }

  const proposedIngredients = (catalog.ingredients ?? [])
    .filter((i) => !knownIngredients.has(normalizeName(i.name)))
    .map((i) => `${i.name} (${i.category})`);
  const proposedAliases = (catalog.aliases ?? []).map(
    (a) => `${a.alias} → ${a.ingredient}`,
  );

  const operations = [
    `upsert ${catalog.ingredients?.length ?? 0} ingredient(s) on name`,
    `upsert ${catalog.aliases?.length ?? 0} alias(es) on alias`,
    `upsert ${recipes.length} recipe(s) on slug, domain = 'food'`,
    `upsert ${recipes.length} food detail row(s) on recipe_id`,
    `replace ${recipes.reduce((n, r) => n + r.ingredients.length, 0)} recipe ingredient line(s)`,
  ];

  return {
    report: {
      catalog: {
        recipes: catalog.recipes.length,
        proposedIngredients,
        proposedAliases,
      },
      accepted,
      rejected,
      unresolved: [...unresolved],
      duplicates,
      operations,
    },
    recipes,
    ingredientNames: names,
  };
}

const q = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
};

const array = (values: string[]): string =>
  values.length === 0 ? "'{}'" : `array[${values.map(q).join(",")}]`;

/**
 * Idempotent SQL for a validated run. Re-running it changes nothing: every
 * insert upserts on a natural key, and the ingredient lines of a recipe are
 * replaced wholesale so a shortened list can't leave orphans behind (§16.6).
 */
export function emitSql(catalog: FoodCatalog, result: IngestResult): string {
  const { recipes, ingredientNames } = result;
  const slugs = recipes.map((r) => r.slug);
  const out: string[] = [
    "-- Food catalog (GENERATED — do not edit by hand).",
    "-- Source of truth: src/data/food-seed.ts   ·   Regenerate: npm run pipeline:food",
    "--",
    "-- Idempotent: every statement upserts on a natural key, so re-running it",
    "-- changes nothing. Apply AFTER the migrations and supabase/seed.sql.",
    "",
  ];

  if (slugs.length > 0) {
    // Deliberately outside the transaction below: raising inside it would
    // abort the block and report "current transaction is aborted" instead of
    // the actual reason.
    out.push(
      "-- Guard: a food recipe must never overwrite a drink that happens to",
      "-- share its slug (both live in one table, and slugs are one namespace).",
      "do $$",
      "declare",
      "  clash text;",
      "begin",
      "  select string_agg(slug, ', ') into clash",
      "  from public.recipes",
      `  where slug = any(${array(slugs)}) and domain <> 'food';`,
      "  if clash is not null then",
      "    raise exception 'food catalog slug(s) already used by another domain: %', clash;",
      "  end if;",
      "end;",
      "$$;",
      "",
    );
  }

  out.push("begin;", "");

  const ingredients = catalog.ingredients ?? [];
  if (ingredients.length > 0) {
    out.push(
      "-- Canonical ingredients. Existing rows keep their id, slug and category.",
      "insert into public.ingredients (name, slug, category, is_staple) values",
      ingredients
        .map(
          (i) =>
            `  (${q(i.name)}, ${q(slugify(i.name))}, ${q(i.category)}, ${q(i.isStaple === true)})`,
        )
        .join(",\n") + "\non conflict (name) do nothing;",
      "",
    );
    const withParents = ingredients.filter((i) => i.parent);
    if (withParents.length > 0) {
      out.push(
        "update public.ingredients child set parent_id = parent.id",
        "from (values",
        withParents.map((i) => `  (${q(i.name)}, ${q(i.parent!)})`).join(",\n"),
        ") as v(child_name, parent_name)",
        "join public.ingredients parent on parent.name = v.parent_name",
        "where child.name = v.child_name;",
        "",
      );
    }
  }

  const aliases = catalog.aliases ?? [];
  if (aliases.length > 0) {
    out.push(
      "insert into public.ingredient_aliases (alias, ingredient_id)",
      "select v.alias, i.id from (values",
      aliases.map((a) => `  (${q(a.alias)}, ${q(a.ingredient)})`).join(",\n"),
      ") as v(alias, ingredient_name)",
      "join public.ingredients i on i.name = v.ingredient_name",
      "on conflict (alias) do nothing;",
      "",
    );
  }

  for (const recipe of recipes) {
    if (recipe.domain !== "food") continue;
    out.push(
      `-- ${recipe.name}`,
      "insert into public.recipes",
      "  (slug, name, domain, description, instructions, difficulty, source, source_url, license, is_published)",
      "values (",
      `  ${q(recipe.slug)}, ${q(recipe.name)}, 'food', ${q(recipe.description)},`,
      `  ${array(recipe.instructions)}, ${recipe.difficulty ? `${q(recipe.difficulty)}::public.recipe_difficulty` : "null"},`,
      `  ${q(recipe.provenance.source)}, ${q(recipe.provenance.source_url)}, ${q(recipe.provenance.license)}, ${q(recipe.is_published)}`,
      ")",
      "on conflict (slug) do update set",
      "  name = excluded.name, domain = excluded.domain,",
      "  description = excluded.description, instructions = excluded.instructions,",
      "  difficulty = excluded.difficulty, source = excluded.source,",
      "  source_url = excluded.source_url, license = excluded.license,",
      "  is_published = excluded.is_published;",
      "",
      "insert into public.food_recipe_details",
      "  (recipe_id, prep_minutes, cook_minutes, total_minutes, servings, course, cuisine)",
      `select id, ${q(recipe.food.prep_minutes)}, ${q(recipe.food.cook_minutes)},`,
      `       ${q(recipe.food.total_minutes)}, ${q(recipe.food.servings)},`,
      `       ${q(recipe.food.course)}, ${q(recipe.food.cuisine)}`,
      `from public.recipes where slug = ${q(recipe.slug)}`,
      "on conflict (recipe_id) do update set",
      "  prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes,",
      "  total_minutes = excluded.total_minutes, servings = excluded.servings,",
      "  course = excluded.course, cuisine = excluded.cuisine;",
      "",
      "-- Replaced wholesale: a shortened ingredient list must not leave orphans.",
      `delete from public.recipe_ingredients where recipe_id = (select id from public.recipes where slug = ${q(recipe.slug)});`,
      "insert into public.recipe_ingredients",
      "  (recipe_id, ingredient_id, amount, unit, preparation, is_optional, is_garnish, display_order, section, raw_text)",
      "select r.id, i.id, v.amount::numeric, v.unit::text, v.preparation::text,",
      "       v.is_optional::boolean, false, v.display_order::int, v.section::text, v.raw_text::text",
      "from (values",
      recipe.ingredients
        .map(
          (line) =>
            `  (${q(ingredientNames.get(line.ingredient_id) ?? "")}, ${q(line.amount)}, ` +
            `${q(line.unit)}, ${q(line.preparation)}, ${q(line.is_optional)}, ` +
            `${q(line.display_order)}, ${q(line.section)}, ${q(line.raw_text)})`,
        )
        .join(",\n"),
      ") as v(ingredient_name, amount, unit, preparation, is_optional, display_order, section, raw_text)",
      `join public.recipes r on r.slug = ${q(recipe.slug)}`,
      "join public.ingredients i on i.name = v.ingredient_name;",
      "",
    );
  }

  out.push("commit;", "");
  return out.join("\n");
}