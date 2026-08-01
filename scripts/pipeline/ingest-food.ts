// Food ingestion CLI (docs/expansion-plan.md §16).
//
//   npm run pipeline:food -- --dry-run          validate and report, write nothing
//   npm run pipeline:food                        write supabase/seed_food.sql
//   npm run pipeline:food -- --catalog x.json    ingest a JSON catalog instead
//   npm run pipeline:food -- --out other.sql     write somewhere else
//
// Offline only, like every other pipeline entry point. It never talks to a
// database: it validates a curated catalog and emits idempotent SQL that is
// applied the same way supabase/seed.sql is. A run that finds anything
// unresolved, duplicated or invalid exits non-zero and writes nothing.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { formatReport, isClean } from "./core/report.ts";
import { emitSql, ingestCatalog } from "./domains/food/ingest.ts";
import { parseCatalog, type FoodCatalog } from "./domains/food/source.ts";

const DEFAULT_OUT = "supabase/seed_food.sql";

type Args = { dryRun: boolean; catalog: string | null; out: string };

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let catalog: string | null = null;
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--catalog") catalog = argv[++i] ?? null;
    else if (arg.startsWith("--catalog=")) catalog = arg.slice(10);
    else if (arg === "--out") out = argv[++i] ?? out;
    else if (arg.startsWith("--out=")) out = arg.slice(6);
  }
  return { dryRun, catalog, out };
}

async function loadCatalog(file: string | null): Promise<FoodCatalog> {
  if (file === null) {
    // The curated catalog that ships with the app (phase 9).
    const seed = await import("../../src/data/food-seed.ts");
    return seed.foodCatalog;
  }
  return parseCatalog(
    JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog(args.catalog);

  const result = ingestCatalog(catalog);
  console.log(formatReport(result.report));

  if (!isClean(result.report)) {
    console.error(
      "\n✗ Nothing written — resolve the problems above and run again.",
    );
    process.exitCode = 1;
    return;
  }
  if (args.dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  await writeFile(args.out, emitSql(catalog, result), "utf8");
  console.log(`\n✓ ${args.out} written. Apply it after supabase/seed.sql.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
