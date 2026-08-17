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
  randomSeed,
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

test("every colour appears by the time the list is as long as the palette", () => {
  for (let n = ACCENTS.length; n <= MAX_LENGTH; n++) {
    expect(new Set(dealAccents(keys(n))).size).toBe(ACCENTS.length);
  }
});

test("the palette is ten distinct names", () => {
  expect(ACCENTS).toHaveLength(10);
  expect(new Set(ACCENTS).size).toBe(10);
  // The original five are unchanged and still lead the bag (D1, amended).
  expect(ACCENTS.slice(0, 5)).toEqual([
    "blue",
    "magenta",
    "pink",
    "lime",
    "cyan",
  ]);
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
    "accent-violet",
    "accent-azure",
    "accent-mint",
    "accent-green",
    "accent-gold",
  ]);
});

test("an empty list deals nothing", () => {
  expect(dealAccents([])).toEqual([]);
});

// ── Re-dealing on every page load ─────────────────────────────────────────
// The seed only chooses which shuffle each bag starts from, so both
// guarantees have to survive every seed — not just the one derived from the
// list. Without this, a reshuffle could quietly put two of a colour together.

test("dispersion and lookback hold for arbitrary seeds", () => {
  const list = keys(37);
  for (let trial = 0; trial < 300; trial++) {
    const dealt = dealAccents(list, randomSeed());
    const counts = ACCENTS.map((a) => dealt.filter((d) => d === a).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    for (let i = 0; i < dealt.length; i++) {
      for (let j = i + 1; j <= i + LOOKBACK && j < dealt.length; j++) {
        expect(dealt[i]).not.toBe(dealt[j]);
      }
    }
  }
});

test("a seed re-deals the same list a different way", () => {
  const list = keys(24);
  const base = dealAccents(list);
  // Not a guarantee for any single seed, but over many seeds the deal must
  // move — otherwise the seed is being ignored.
  const moved = Array.from({ length: 50 }, () =>
    dealAccents(list, randomSeed()),
  ).filter((d) => d.join() !== base.join());
  expect(moved.length).toBeGreaterThan(40);
});

test("the same seed always deals the same way", () => {
  const list = keys(24);
  const seed = randomSeed();
  expect(dealAccents(list, seed)).toEqual(dealAccents(list, seed));
});

test("an omitted seed is still derived from the list, unchanged", () => {
  // What the server renders into cacheable HTML must not move.
  const list = keys(24);
  expect(dealAccents(list)).toEqual(dealAccents(list, undefined));
});

test("accentFor re-picks with a seed and is stable without one", () => {
  expect(accentFor("home-hero")).toBe(accentFor("home-hero"));
  expect(accentFor("home-hero", 0)).toBe(accentFor("home-hero"));
  const picks = new Set(
    Array.from({ length: 200 }, () => accentFor("home-hero", randomSeed())),
  );
  expect(picks.size).toBe(ACCENTS.length);
});

test("randomSeed returns a 32-bit unsigned integer", () => {
  for (let i = 0; i < 500; i++) {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  }
});
