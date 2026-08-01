// The controlled unit vocabulary, plus a deliberate fallback
// (docs/expansion-plan.md §32 "Unit Strategy").
//
// Units stay `text` in the database. A recipe line may carry a unit nobody
// anticipated ("bunch", "handful") and that is better recorded than dropped,
// so this is normalisation with a known-set check — not a constraint.
//
// `oz` means FLUID ounce in this catalog: that is what the bar has always
// meant by it, and src/lib/units/format.ts converts it to millilitres on that
// assumption. Food weights therefore use `g`, `kg` or `lb`, never `oz`.

/** Canonical units, grouped by what they measure. */
export const KNOWN_UNITS = [
  // volume
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "ml",
  "l",
  "dash",
  "splash",
  "drop",
  "barspoon",
  // weight
  "g",
  "kg",
  "lb",
  // count and pieces
  "each",
  "pinch",
  "clove",
  "slice",
  "can",
  "sprig",
  "leaves",
] as const;

export type KnownUnit = (typeof KNOWN_UNITS)[number];

const KNOWN = new Set<string>(KNOWN_UNITS);

/** Spellings seen in recipe text, mapped to the canonical form. */
const ALIASES: Record<string, KnownUnit> = {
  t: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsps: "tsp",
  tbs: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cups: "cup",
  c: "cup",
  ounce: "oz",
  ounces: "oz",
  ozs: "oz",
  "fl oz": "oz",
  "fluid ounce": "oz",
  "fluid ounces": "oz",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  dashes: "dash",
  splashes: "splash",
  drops: "drop",
  barspoons: "barspoon",
  gram: "g",
  grams: "g",
  gr: "g",
  kilogram: "kg",
  kilograms: "kg",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  count: "each",
  piece: "each",
  pieces: "each",
  whole: "each",
  pinches: "pinch",
  cloves: "clove",
  slices: "slice",
  cans: "can",
  sprigs: "sprig",
  leaf: "leaves",
  large: "each",
  medium: "each",
  small: "each",
};

/**
 * Fold a written unit to its canonical form. Unknown units are cleaned up and
 * returned as-is — the intentional fallback — so callers that care can ask
 * `isKnownUnit` separately. Empty input is null: "salt, to taste" has no unit.
 */
export function normalizeUnit(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "")
    .replace(/\s+/g, " ");
  if (cleaned === "") return null;
  if (KNOWN.has(cleaned)) return cleaned;
  return ALIASES[cleaned] ?? cleaned;
}

export function isKnownUnit(unit: string | null | undefined): boolean {
  return unit != null && KNOWN.has(unit);
}
