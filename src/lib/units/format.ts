// Amount formatting for recipe ingredient lines: the serving scaler's
// multiplier and the oz⇄ml preference, applied in one pure step so every
// surface that renders amounts (recipe detail, matches cards) formats them
// identically. No React, no storage — see ./store.ts for the preference.

export type Unit = "oz" | "ml";

const ML_PER_OZ = 29.5735;

// Only fluid ounces convert. dash / barspoon / tsp / tbsp / each / leaves are
// left exactly as written — a "2 dash" line means two dashes at any unit
// preference.
const OUNCE_UNITS = new Set([
  "oz",
  "ozs",
  "oz.",
  "ounce",
  "ounces",
  "fl oz",
  "fl. oz.",
  "fluid ounce",
  "fluid ounces",
]);

// Bar measures are written in halves, thirds, quarters and eighths; anything
// else falls back to a decimal.
const DENOMINATORS = [2, 3, 4, 8];
const FRACTION_GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
};

const EPSILON = 1e-6;

export function isOunce(unit: string | null): boolean {
  return unit !== null && OUNCE_UNITS.has(unit.trim().toLowerCase());
}

/** At most two decimals, without a trailing ".0" / ".50". */
function decimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** 1.5 → "1½", 0.75 → "¾", 2 → "2", 1.2 → "1.2". */
function formatOunces(value: number): string {
  const whole = Math.floor(value + EPSILON);
  const fraction = value - whole;
  if (fraction < EPSILON) return String(whole);
  for (const d of DENOMINATORS) {
    const n = Math.round(fraction * d);
    if (n === 0 || n === d) continue;
    if (Math.abs(fraction - n / d) > EPSILON) continue;
    const glyph = FRACTION_GLYPHS[`${n}/${d}`];
    if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  return decimal(value);
}

/** Rounded to the nearest 5 ml — the precision a jigger actually delivers. */
function formatMilliliters(ounces: number): string {
  return String(Math.max(5, Math.round((ounces * ML_PER_OZ) / 5) * 5));
}

/**
 * Scale and convert one ingredient amount. `scale` is the serving multiplier
 * (1 on surfaces without a scaler). Non-volumetric units keep their own unit
 * string and are only scaled.
 */
export function formatQuantity(
  amount: number | null,
  unit: string | null,
  target: Unit,
  scale = 1,
): { amount: string | null; unit: string | null } {
  if (amount === null) return { amount: null, unit };
  const scaled = amount * scale;
  if (!isOunce(unit)) return { amount: decimal(scaled), unit };
  return target === "ml"
    ? { amount: formatMilliliters(scaled), unit: "ml" }
    : { amount: formatOunces(scaled), unit: "oz" };
}