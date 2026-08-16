// The accent dealer (ux-plan.md P2, D5). Colour is decoration dealt from a
// bag, not an identity hashed per entity — a hash-per-entity can guarantee
// neither equal dispersion nor the absence of neighbouring repeats. These are
// the two guarantees, asserted across every list length the app can render,
// plus the determinism that keeps server and client render identical.

import { expect, test } from "vitest";

import {
  ACCENTS,
  accentClass,
  accentFor,
  dealAccents,
  type Accent,
} from "../src/lib/theme/accents.ts";

/** The lookback the dealer promises: 3 covers 1-, 2- and 3-column grids. */
const LOOKBACK = 3;

const MAX_LENGTH = 200;

/** Distinct keys, so no list under test leans on duplicate input. */
function keys(length: number): string[] {
  return Array.from({ length }, (_, i) => `recipe-${i}`);
}

test("counts across any list differ by at most 1", () => {
  for (let n = 1; n <= MAX_LENGTH; n++) {
    const dealt = dealAccents(keys(n));
    expect(dealt).toHaveLength(n);
    const counts = ACCENTS.map(
      (a) => dealt.filter((d) => d === a).length,
    );
    // Colours the list is too short to reach count 0, which is still within 1
    // of the others until every colour has been dealt once.
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  }
});

test("no two entries within 3 positions share a colour", () => {
  for (let n = 1; n <= MAX_LENGTH; n++) {
    const dealt = dealAccents(keys(n));
    for (let i = 0; i < dealt.length; i++) {
      for (let j = i + 1; j <= i + LOOKBACK && j < dealt.length; j++) {
        expect(
          dealt[i],
          `length ${n}: positions ${i} and ${j} both ${dealt[i]}`,
        ).not.toBe(dealt[j]);
      }
    }
  }
});

test("all five colours appear by length 5", () => {
  for (let n = 5; n <= MAX_LENGTH; n++) {
    expect(new Set(dealAccents(keys(n))).size).toBe(ACCENTS.length);
  }
});

test("dealing is deterministic — the same keys give the same array", () => {
  // The guarantee that matters at render: RecipeCard is used inside both
  // server and client components, so a divergence here repaints the page.
  for (const n of [1, 2, 7, 24, 160]) {
    const list = keys(n);
    expect(dealAccents(list)).toEqual(dealAccents(list));
  }
});

test("the deal depends on the list, not on call order", () => {
  const a = dealAccents(["negroni", "daiquiri", "martini"]);
  dealAccents(["something", "else", "entirely"]);
  expect(dealAccents(["negroni", "daiquiri", "martini"])).toEqual(a);
});

test("accentFor is stable across calls and returns a real accent", () => {
  for (const key of ["cocktail", "food", "home-hero", "No favorites yet"]) {
    const first = accentFor(key);
    expect(ACCENTS).toContain(first);
    expect(accentFor(key)).toBe(first);
  }
});

test("accentClass names the CSS class that rebinds --accent", () => {
  for (const accent of ACCENTS) {
    expect(accentClass(accent)).toBe(`accent-${accent}`);
  }
  // The wrapper classes the stylesheet actually defines (D6).
  expect(ACCENTS.map((a: Accent) => accentClass(a))).toEqual([
    "accent-blue",
    "accent-magenta",
    "accent-pink",
    "accent-lime",
    "accent-cyan",
  ]);
});

test("an empty list deals nothing", () => {
  expect(dealAccents([])).toEqual([]);
});
