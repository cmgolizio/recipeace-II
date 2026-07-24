// Recipe-metadata tests (polish-plan2 phase 5): the pure sanitizer that
// constrains model-emitted metadata to the controlled vocabularies, plus a
// smoke check that the new columns from the metadata migration accept and
// return values (the real migration runs via tests/db.ts).

import { afterAll, beforeAll, expect, test } from "vitest";

import type { PGlite } from "@electric-sql/pglite";

import { sanitizeMetadata } from "../scripts/pipeline/validate.ts";
import { createSeededDb, recipeIdBySlug } from "./db";

test("sanitizeMetadata passes valid metadata through, rounding strength", () => {
  expect(
    sanitizeMetadata({
      strength: 23.6,
      difficulty: "medium",
      flavor_tags: ["citrusy", "boozy"],
      base_spirit: " gin ",
    }),
  ).toEqual({
    strength: 24,
    difficulty: "medium",
    flavor_tags: ["citrusy", "boozy"],
    base_spirit: "gin",
  });
});

test("sanitizeMetadata nulls implausible strength and unknown difficulty", () => {
  expect(sanitizeMetadata({ strength: 250, difficulty: "expert" })).toEqual({
    strength: null,
    difficulty: null,
    flavor_tags: [],
    base_spirit: null,
  });
  expect(sanitizeMetadata({ strength: -3 }).strength).toBeNull();
  expect(sanitizeMetadata({ strength: Number.NaN }).strength).toBeNull();
});

test("sanitizeMetadata drops unknown flavor tags and duplicates", () => {
  expect(
    sanitizeMetadata({
      flavor_tags: ["sweet", "umami", "sweet", "smoky"],
    }).flavor_tags,
  ).toEqual(["sweet", "smoky"]);
});

test("sanitizeMetadata nulls blank base_spirit", () => {
  expect(sanitizeMetadata({ base_spirit: "   " }).base_spirit).toBeNull();
});

// ── Migration smoke check ───────────────────────────────────────────────────
let db: PGlite;

beforeAll(async () => {
  db = await createSeededDb();
});

afterAll(async () => {
  await db.close();
});

test("recipes accept and return the new metadata columns", async () => {
  const id = await recipeIdBySlug(db, "daiquiri");
  await db.query(
    `update public.recipes
     set strength = $2, difficulty = $3, flavor_tags = $4, base_spirit = $5
     where id = $1`,
    [id, 20, "easy", ["citrusy", "sour"], "white rum"],
  );
  const { rows } = await db.query<{
    strength: number;
    difficulty: string;
    flavor_tags: string[];
    base_spirit: string;
  }>(
    "select strength, difficulty, flavor_tags, base_spirit from public.recipes where id = $1",
    [id],
  );
  expect(rows[0]).toEqual({
    strength: 20,
    difficulty: "easy",
    flavor_tags: ["citrusy", "sour"],
    base_spirit: "white rum",
  });
});
