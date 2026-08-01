// The food validator (docs/expansion-plan.md §16.4). Pure — no I/O, no
// network, no database — so the whole thing is unit-testable, and so a dry run
// and a real ingest reach exactly the same verdict.
//
// Every rule here exists because a bad food recipe is worse than a missing
// one: a recipe that half-resolves silently is how a catalog rots.

import {
  isKnownUnit,
  normalizeUnit,
} from "../../../../src/lib/units/vocabulary.ts";
import type {
  ResolvedFoodDetails,
  ResolvedIngredient,
  ResolvedRecipe,
  Resolver,
} from "../../core/types.ts";
import { slugify } from "../../core/slug.ts";
import type { FoodSourceIngredientLine, FoodSourceRecipe } from "./source.ts";

const MAX_SERVINGS = 100;
const MAX_MINUTES = 60 * 24;

export type FoodValidation =
  | {
      status: "ok";
      recipe: ResolvedRecipe;
      warnings: string[];
      /** Lines whose ingredient name is not in the taxonomy. */
      unresolved: string[];
    }
  | { status: "rejected"; reason: string; unresolved: string[] };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

/** "2 tbsp olive oil" — provenance of the line as the catalog wrote it. */
function rawText(line: FoodSourceIngredientLine, unit: string | null): string {
  return [line.amount ?? "", unit ?? "", line.name]
    .filter((part) => part !== "" && part !== null)
    .join(" ")
    .trim();
}

/**
 * Total time: taken as given, or derived from prep + cook. A stated total that
 * is less than the work it contains is a data error, not a rounding quirk.
 */
function resolveTimes(recipe: FoodSourceRecipe): {
  times: Pick<
    ResolvedFoodDetails,
    "prep_minutes" | "cook_minutes" | "total_minutes"
  >;
  error: string | null;
} {
  const prep = positiveInt(recipe.prepMinutes);
  const cook = positiveInt(recipe.cookMinutes);
  const stated = positiveInt(recipe.totalMinutes);
  const derived = prep !== null && cook !== null ? prep + cook : null;
  const total = stated ?? derived;
  const times = { prep_minutes: prep, cook_minutes: cook, total_minutes: total };

  for (const [label, value] of [
    ["prep", recipe.prepMinutes],
    ["cook", recipe.cookMinutes],
    ["total", recipe.totalMinutes],
  ] as const) {
    if (value !== undefined && (typeof value !== "number" || value < 0)) {
      return { times, error: `${label} time must be a non-negative number` };
    }
  }
  if (total !== null && total > MAX_MINUTES) {
    return { times, error: `total time of ${total} minutes is implausible` };
  }
  if (stated !== null && derived !== null && stated < Math.max(prep!, cook!)) {
    return {
      times,
      error: `total time (${stated}) is less than prep (${prep}) or cook (${cook})`,
    };
  }
  return { times, error: null };
}

/**
 * Validate one curated food recipe and resolve its ingredients against the
 * shared taxonomy. Unlike the drinks adapter, a repeated ingredient is kept —
 * "olive oil, divided" is two lines of one recipe, not a mistake (phase 7).
 */
export function validateFoodRecipe(
  source: FoodSourceRecipe,
  resolve: Resolver,
): FoodValidation {
  const unresolved: string[] = [];
  const warnings: string[] = [];

  const name = str(source.name);
  if (!name) return { status: "rejected", reason: "missing name", unresolved };

  const slug = str(source.slug) ?? slugify(name);
  if (!slug) {
    return {
      status: "rejected",
      reason: `name "${name}" produced an empty slug`,
      unresolved,
    };
  }

  const instructions = (source.instructions ?? [])
    .map((step) => str(step))
    .filter((step): step is string => step !== null);
  if (instructions.length === 0) {
    return {
      status: "rejected",
      reason: `"${name}" has no instructions`,
      unresolved,
    };
  }

  const provenanceName = str(source.source?.name);
  const license = str(source.source?.license);
  if (!provenanceName || !license) {
    return {
      status: "rejected",
      reason: `"${name}" is missing source name or licence — §15 requires both before publication`,
      unresolved,
    };
  }

  const servings = positiveInt(source.servings);
  if (servings === null || servings < 1 || servings > MAX_SERVINGS) {
    return {
      status: "rejected",
      reason: `"${name}" needs a plausible servings count (1–${MAX_SERVINGS})`,
      unresolved,
    };
  }

  const { times, error: timeError } = resolveTimes(source);
  if (timeError) {
    return { status: "rejected", reason: `"${name}": ${timeError}`, unresolved };
  }

  const ingredients: ResolvedIngredient[] = [];
  for (const line of source.ingredients ?? []) {
    const lineName = str(line?.name);
    if (!lineName) continue;
    const id = resolve(lineName);
    if (id === null) {
      unresolved.push(lineName);
      continue;
    }

    const amount =
      typeof line.amount === "number" && Number.isFinite(line.amount)
        ? line.amount
        : null;
    if (amount !== null && amount <= 0) {
      return {
        status: "rejected",
        reason: `"${name}" gives ${lineName} a non-positive amount`,
        unresolved,
      };
    }
    const unit = normalizeUnit(line.unit);
    if (unit !== null && !isKnownUnit(unit)) {
      warnings.push(`unit "${unit}" (${lineName}) is outside the vocabulary`);
    }
    if (amount !== null && unit === null) {
      warnings.push(`${lineName} has an amount but no unit`);
    }

    ingredients.push({
      ingredient_id: id,
      amount,
      unit,
      preparation: str(line.preparation),
      is_optional: line.optional === true,
      // A drink's garnish flag has no food analogue; "for serving" lines are
      // simply optional (phase 7).
      is_garnish: false,
      display_order: ingredients.length + 1,
      raw_text: rawText(line, unit),
      section: str(line.section),
    });
  }

  if (unresolved.length > 0) {
    return {
      status: "rejected",
      reason: `"${name}" uses ${unresolved.length} ingredient(s) the taxonomy doesn't have`,
      unresolved,
    };
  }

  const required = ingredients.filter((i) => !i.is_optional);
  if (required.length < 2) {
    return {
      status: "rejected",
      reason: `"${name}" resolved fewer than 2 required ingredients`,
      unresolved,
    };
  }

  // Every ingredient should appear somewhere in the method; one that doesn't
  // is usually a line the writer forgot to use.
  const method = instructions.join(" ").toLowerCase();
  for (const line of source.ingredients ?? []) {
    const lineName = str(line?.name);
    if (!lineName) continue;
    const head = lineName.toLowerCase().split(/[\s,]/)[0];
    if (head.length > 3 && !method.includes(head)) {
      warnings.push(`${lineName} is never mentioned in the instructions`);
    }
  }

  const food: ResolvedFoodDetails = {
    ...times,
    servings,
    course: str(source.course),
    cuisine: str(source.cuisine),
  };

  return {
    status: "ok",
    warnings,
    unresolved,
    recipe: {
      domain: "food",
      slug,
      name,
      description: str(source.description),
      difficulty: source.difficulty ?? null,
      instructions,
      ingredients,
      provenance: {
        source: provenanceName,
        source_url: str(source.source?.url),
        license,
      },
      // Reviewed content only: publication is an explicit editorial act.
      is_published: source.publish === true,
      food,
    },
  };
}
