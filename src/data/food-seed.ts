/**
 * The curated food catalog — the Kitchen's reference data (expansion phase 9).
 *
 * Structure mirrors src/data/cocktail-seed.ts: a typed source of truth that
 * compiles to idempotent SQL. Here the compiler is the food ingestion adapter:
 *
 *     npm run pipeline:food -- --dry-run    validate and report
 *     npm run pipeline:food                 write supabase/seed_food.sql
 *
 * Every recipe declares its source and licence, and lands unpublished until it
 * has been reviewed (docs/expansion-plan.md §15, §34).
 */

import type { FoodCatalog } from "../../scripts/pipeline/domains/food/source.ts";

export const foodCatalog: FoodCatalog = {
  ingredients: [],
  aliases: [],
  recipes: [],
};
