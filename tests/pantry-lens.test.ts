// The pantry lens (restructure phase 2): the pure category→domain map behind
// the split shelf and the grouped ingredient results. No database — the lens is
// presentation, and `ingredients.category` stays domain-agnostic in the schema.

import { expect, test } from "vitest";

import {
  categoryDomains,
  isShared,
  servesDomain,
  splitByLens,
  type IngredientCategory,
} from "../src/lib/pantry/lens.ts";

/** A pantry chip carries just enough for the lens to place it. */
function item(name: string, category: IngredientCategory) {
  return { name, category };
}

const bourbon = item("bourbon", "spirit");
const lime = item("lime", "produce");
const chicken = item("chicken thighs", "meat");

test("the Bar shelf keeps spirits and the shared items, and sets meat aside", () => {
  expect(splitByLens([bourbon, lime, chicken], "cocktail")).toEqual({
    mine: [bourbon, lime],
    other: [chicken],
  });
});

test("the Kitchen shelf keeps meat and the same shared items", () => {
  // Lime lands on whichever shelf is being looked at — it is genuinely both.
  expect(splitByLens([bourbon, lime, chicken], "food")).toEqual({
    mine: [lime, chicken],
    other: [bourbon],
  });
});

test("a category serving both sides is shared; a bar-only one is not", () => {
  expect(isShared("produce")).toBe(true);
  expect(isShared("spirit")).toBe(false);
  expect(categoryDomains("wine")).toEqual(["cocktail", "food"]);
  expect(servesDomain("wine", "food")).toBe(true);
  expect(servesDomain("pasta", "cocktail")).toBe(false);
});

test("input order survives the split, within each bucket", () => {
  const rye = item("rye", "spirit");
  const pasta = item("pasta", "pasta");
  const gin = item("gin", "spirit");
  const { mine, other } = splitByLens(
    [rye, pasta, gin, chicken, bourbon],
    "cocktail",
  );
  expect(mine.map((i) => i.name)).toEqual(["rye", "gin", "bourbon"]);
  expect(other.map((i) => i.name)).toEqual(["pasta", "chicken thighs"]);
});