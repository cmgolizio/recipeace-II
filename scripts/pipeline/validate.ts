// Pure validation + ingredient resolution for the generation pipeline.
// No I/O here, so this is unit-testable on its own.

export type GeneratedIngredient = {
  name: string;
  amount?: number | null;
  unit?: string | null;
  optional?: boolean;
  garnish?: boolean;
};

export type GeneratedRecipe = {
  name: string;
  description?: string | null;
  glass?: string | null;
  method?: string | null;
  garnish?: string | null;
  instructions?: string[];
  ingredients?: GeneratedIngredient[];
};

export type ResolvedIngredient = {
  ingredient_id: number;
  amount: number | null;
  unit: string | null;
  preparation: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  display_order: number;
  raw_text: string | null;
};

export type ResolvedRecipe = {
  slug: string;
  name: string;
  description: string | null;
  method: string | null;
  glass: string | null;
  garnish: string | null;
  instructions: string[];
  ingredients: ResolvedIngredient[];
};

export type ValidationResult =
  | { status: "ok"; recipe: ResolvedRecipe; dropped: string[] }
  | { status: "rejected"; reason: string };

/** Resolve an ingredient name (or alias) to its id, or null if unknown. */
export type Resolver = (name: string) => number | null;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function rawText(amount: number | null, unit: string | null, name: string): string {
  return [amount ?? "", unit ?? "", name].filter((x) => x !== "").join(" ").trim();
}

/**
 * Validate one generated recipe and resolve its ingredients against the
 * taxonomy. Rejects the recipe if a required (non-optional) ingredient can't be
 * resolved; optional/garnish ingredients that can't be resolved are dropped.
 */
export function validateRecipe(
  gen: GeneratedRecipe,
  resolve: Resolver,
): ValidationResult {
  const name = str(gen.name);
  if (!name) return { status: "rejected", reason: "missing name" };

  const slug = slugify(name);
  if (!slug) return { status: "rejected", reason: `name "${name}" produced an empty slug` };

  const instructions = (gen.instructions ?? [])
    .map((s) => str(s))
    .filter((s): s is string => s !== null);
  if (instructions.length === 0) {
    return { status: "rejected", reason: `"${name}" has no instructions` };
  }

  const dropped: string[] = [];
  const ingredients: ResolvedIngredient[] = [];

  for (const raw of gen.ingredients ?? []) {
    const ingName = str(raw?.name);
    if (!ingName) continue;
    const isOptional = raw.optional === true;
    const isGarnish = raw.garnish === true;
    const id = resolve(ingName);

    if (id === null) {
      if (isOptional || isGarnish) {
        dropped.push(ingName);
        continue;
      }
      return { status: "rejected", reason: `"${name}" uses unknown ingredient "${ingName}"` };
    }

    const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount)
      ? raw.amount
      : null;
    const unit = str(raw.unit);
    ingredients.push({
      ingredient_id: id,
      amount,
      unit,
      preparation: null,
      is_optional: isOptional,
      is_garnish: isGarnish,
      display_order: ingredients.length + 1,
      raw_text: rawText(amount, unit, ingName),
    });
  }

  // De-duplicate ingredient ids within the recipe (the table is unique on
  // (recipe_id, ingredient_id)); keep the first occurrence.
  const seen = new Set<number>();
  const deduped = ingredients.filter((i) => {
    if (seen.has(i.ingredient_id)) return false;
    seen.add(i.ingredient_id);
    return true;
  });

  const required = deduped.filter((i) => !i.is_optional && !i.is_garnish);
  if (required.length < 2) {
    return { status: "rejected", reason: `"${name}" resolved fewer than 2 core ingredients` };
  }

  return {
    status: "ok",
    dropped,
    recipe: {
      slug,
      name,
      description: str(gen.description),
      method: str(gen.method),
      glass: str(gen.glass),
      garnish: str(gen.garnish),
      instructions,
      ingredients: deduped.map((i, idx) => ({ ...i, display_order: idx + 1 })),
    },
  };
}