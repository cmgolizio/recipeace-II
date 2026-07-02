// Recipe generation pipeline: generate -> validate -> dedup -> ingest.
//
//   npm run pipeline -- --count 8            generate and ingest 8 recipes
//   npm run pipeline -- --count 12 --dry-run generate and validate only
//   npm run pipeline -- --provider openai    use OpenAI instead of Anthropic
//
// Provider defaults to Anthropic; pass --provider openai (or set
// PIPELINE_PROVIDER=openai) to fall back to OpenAI when Anthropic credits run
// out. Requires the chosen provider's key (ANTHROPIC_API_KEY or
// OPENAI_TEXT_API_KEY), plus NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
// Offline only — this is the single place the AI is invoked; it never runs in
// the live request path.

import {
  createAdminClient,
  ingestRecipe,
  loadExistingRecipes,
  loadTaxonomy,
} from "./db.ts";
import { generateRecipes, type Provider } from "./generate.ts";
import { validateRecipe } from "./validate.ts";

type Args = { count: number; dryRun: boolean; provider: Provider | null };

function parseProvider(value: string | undefined): Provider | null {
  if (value === "openai" || value === "anthropic") return value;
  return null;
}

function parseArgs(argv: string[]): Args {
  let count = 8;
  let dryRun = false;
  let provider: Provider | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--count") {
      const n = Number(argv[i + 1]);
      if (Number.isInteger(n) && n > 0) count = n;
      i++;
    } else if (arg.startsWith("--count=")) {
      const n = Number(arg.slice("--count=".length));
      if (Number.isInteger(n) && n > 0) count = n;
    } else if (arg === "--provider") {
      provider = parseProvider(argv[i + 1]) ?? provider;
      i++;
    } else if (arg.startsWith("--provider=")) {
      provider = parseProvider(arg.slice("--provider=".length)) ?? provider;
    }
  }
  return { count, dryRun, provider };
}

async function main(): Promise<void> {
  const { count, dryRun, provider: providerArg } = parseArgs(process.argv.slice(2));
  const provider: Provider =
    providerArg ?? (process.env.PIPELINE_PROVIDER === "openai" ? "openai" : "anthropic");
  const model =
    provider === "openai"
      ? (process.env.OPENAI_PIPELINE_MODEL ?? "gpt-4o")
      : (process.env.PIPELINE_MODEL ?? "claude-opus-4-8");

  const requiredKey = provider === "openai" ? "OPENAI_TEXT_API_KEY" : "ANTHROPIC_API_KEY";
  if (!process.env[requiredKey]) {
    throw new Error(`Missing required env var ${requiredKey}`);
  }

  const admin = createAdminClient();
  console.log("▶ loading taxonomy and existing recipes…");
  const taxonomy = await loadTaxonomy(admin);
  const existing = await loadExistingRecipes(admin);
  console.log(
    `  ${taxonomy.vocabulary.length} ingredients, ${existing.names.length} existing recipes`,
  );

  console.log(`▶ generating ${count} recipe(s) with ${provider} (${model})…`);
  const generated = await generateRecipes({
    provider,
    count,
    vocabulary: taxonomy.vocabulary,
    avoidNames: existing.names,
    model,
  });
  console.log(`  model returned ${generated.length} recipe(s)`);

  const seenSlugs = new Set(existing.slugs);
  const rejected: string[] = [];
  let accepted = 0;

  for (const gen of generated) {
    const result = validateRecipe(gen, taxonomy.resolve);
    if (result.status === "rejected") {
      rejected.push(result.reason);
      continue;
    }
    if (seenSlugs.has(result.recipe.slug)) {
      rejected.push(`"${result.recipe.name}" duplicates an existing recipe`);
      continue;
    }
    seenSlugs.add(result.recipe.slug);
    accepted++;

    if (result.dropped.length > 0) {
      console.log(
        `  · ${result.recipe.name}: dropped unknown optional/garnish ${result.dropped.join(", ")}`,
      );
    }

    if (dryRun) {
      console.log(
        `  ✓ ${result.recipe.name} — ${result.recipe.ingredients.length} ingredients [dry-run]`,
      );
    } else {
      await ingestRecipe(admin, result.recipe);
      console.log(`  ✓ ingested ${result.recipe.name}`);
    }
  }

  console.log("\n— summary —");
  console.log(`  generated: ${generated.length}`);
  console.log(`  ${dryRun ? "would ingest" : "ingested"}: ${accepted}`);
  console.log(`  rejected:  ${rejected.length}`);
  for (const reason of rejected) console.log(`    - ${reason}`);
}

main().catch((err: unknown) => {
  console.error(`✖ pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});