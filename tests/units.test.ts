// Unit formatting (polish-plan2 phase 6): the pure helper behind the oz⇄ml
// toggle and the serving scaler. No database — this is the whole surface the
// recipe detail and matches cards render amounts through.

import { expect, test } from "vitest";

import { formatQuantity, isOunce } from "../src/lib/units/format.ts";

test("ounce amounts render as fractions", () => {
  expect(formatQuantity(0.75, "oz", "oz")).toEqual({ amount: "¾", unit: "oz" });
  expect(formatQuantity(1.5, "oz", "oz")).toEqual({ amount: "1½", unit: "oz" });
  expect(formatQuantity(2, "oz", "oz")).toEqual({ amount: "2", unit: "oz" });
  expect(formatQuantity(0.25, "oz", "oz")).toEqual({ amount: "¼", unit: "oz" });
});

test("ounces convert to millilitres, rounded to the nearest 5", () => {
  // 2 oz = 59.147 ml, 0.75 oz = 22.18 ml, 0.25 oz = 7.39 ml.
  expect(formatQuantity(2, "oz", "ml")).toEqual({ amount: "60", unit: "ml" });
  expect(formatQuantity(0.75, "oz", "ml")).toEqual({ amount: "20", unit: "ml" });
  expect(formatQuantity(0.25, "oz", "ml")).toEqual({ amount: "5", unit: "ml" });
});

test("non-volumetric units are never converted", () => {
  for (const unit of ["dash", "barspoon", "tsp", "tbsp", "each", "leaves"]) {
    expect(formatQuantity(2, unit, "ml")).toEqual({ amount: "2", unit });
  }
  expect(isOunce("dash")).toBe(false);
  expect(isOunce("Fl Oz")).toBe(true);
  expect(isOunce(null)).toBe(false);
});

test("the scaler multiplies, and composes with the unit preference", () => {
  expect(formatQuantity(0.75, "oz", "oz", 2)).toEqual({
    amount: "1½",
    unit: "oz",
  });
  expect(formatQuantity(0.75, "oz", "ml", 2)).toEqual({
    amount: "45",
    unit: "ml",
  });
  // Non-volumetric amounts scale too — 2× a mojito is 16 mint leaves.
  expect(formatQuantity(8, "leaves", "oz", 2)).toEqual({
    amount: "16",
    unit: "leaves",
  });
});

test("amountless rows (garnishes) keep their unit and render no number", () => {
  expect(formatQuantity(null, null, "ml", 4)).toEqual({
    amount: null,
    unit: null,
  });
});

test("amounts that aren’t clean fractions fall back to a decimal", () => {
  expect(formatQuantity(0.7, "oz", "oz")).toEqual({ amount: "0.7", unit: "oz" });
});