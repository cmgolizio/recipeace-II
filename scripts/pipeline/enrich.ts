// Enrichment step: backfill strength / difficulty / flavor tags / base spirit
// for published recipes that don't have them yet (difficulty still null).
// Idempotent — rerun any time; already-enriched recipes are skipped. Run with:
//   npm run pipeline:enrich
//   npm run pipeline:enrich -- --provider openai
//
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and the chosen
// provider's key (ANTHROPIC_API_KEY by default; OPENAI_TEXT_API_KEY with
// --provider openai / PIPELINE_PROVIDER=openai). Each recipe is isolated, so
// one failure doesn't abort the batch. Offline only — never the request path.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import {
  createAdminClient,
  loadRecipesMissingMetadata,
  updateRecipeMetadata,
  type RecipeForEnrich,
} from "./db.ts";
import { METADATA_PROPERTIES, type Provider } from "./generate.ts";
import { sanitizeMetadata, type GeneratedMetadata } from "./validate.ts";

const SYSTEM = `You are an expert bartender annotating a cocktail database. \
Given a cocktail's name and ingredient list, estimate its metadata accurately: \
the strength of the finished, diluted drink, how hard it is to make well, its \
flavor profile, and its base spirit.`;

// Same strict-compatible shape as the generation schema, reusing the exact
// field definitions so the two paths can't drift.
const METADATA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: METADATA_PROPERTIES,
  required: ["strength", "difficulty", "flavor_tags", "base_spirit"],
};

function buildPrompt(recipe: RecipeForEnrich): string {
  return [
    `Cocktail: ${recipe.name}`,
    "Ingredients:",
    ...recipe.ingredients.map((line) => `- ${line}`),
    "",
    "Estimate the metadata fields for this cocktail.",
  ].join("\n");
}

async function enrichAnthropic(model: string, prompt: string): Promise<GeneratedMetadata> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const message = await client.messages.create({
    model,
    max_tokens: 1000,
    system: SYSTEM,
    tools: [
      {
        name: "emit_metadata",
        description: "Return the cocktail's metadata.",
        input_schema: METADATA_SCHEMA as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "emit_metadata" },
    messages: [{ role: "user", content: prompt }],
  });
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic did not return the emit_metadata tool call");
  return toolUse.input as GeneratedMetadata;
}

async function enrichOpenAI(model: string, prompt: string): Promise<GeneratedMetadata> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_TEXT_API_KEY,
    timeout: 120_000,
    maxRetries: 2,
  });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cocktail_metadata",
        schema: METADATA_SCHEMA as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const message = completion.choices[0]?.message;
  if (message?.refusal) throw new Error(`OpenAI refused: ${message.refusal}`);
  if (!message?.content) throw new Error("OpenAI returned no content");
  return JSON.parse(message.content) as GeneratedMetadata;
}

function parseProvider(argv: string[]): Provider {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--provider" && (argv[i + 1] === "openai" || argv[i + 1] === "anthropic")) {
      return argv[i + 1] as Provider;
    }
    if (argv[i] === "--provider=openai") return "openai";
    if (argv[i] === "--provider=anthropic") return "anthropic";
  }
  return process.env.PIPELINE_PROVIDER === "openai" ? "openai" : "anthropic";
}

async function main(): Promise<void> {
  const provider = parseProvider(process.argv.slice(2));
  const model =
    provider === "openai"
      ? (process.env.OPENAI_PIPELINE_MODEL ?? "gpt-4o")
      : (process.env.PIPELINE_MODEL ?? "claude-opus-4-8");

  const requiredKey = provider === "openai" ? "OPENAI_TEXT_API_KEY" : "ANTHROPIC_API_KEY";
  if (!process.env[requiredKey]) {
    throw new Error(`Missing required env var ${requiredKey}`);
  }

  const admin = createAdminClient();
  const recipes = await loadRecipesMissingMetadata(admin);
  console.log(`▶ ${recipes.length} recipe(s) need metadata (${provider}, ${model})`);

  let ok = 0;
  const failures: string[] = [];

  for (const recipe of recipes) {
    const started = Date.now();
    try {
      const prompt = buildPrompt(recipe);
      const raw =
        provider === "openai"
          ? await enrichOpenAI(model, prompt)
          : await enrichAnthropic(model, prompt);
      const meta = sanitizeMetadata(raw);
      await updateRecipeMetadata(admin, recipe.id, meta);
      ok++;
      console.log(
        `  ✓ ${recipe.name} — ~${meta.strength ?? "?"}% · ${meta.difficulty ?? "?"} · ` +
          `[${meta.flavor_tags.join(", ")}] · ${meta.base_spirit ?? "no base spirit"} ` +
          `(${Date.now() - started} ms)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${recipe.name}: ${message}`);
      console.error(`  ✗ ${recipe.name} — ${message} (${Date.now() - started} ms)`);
    }
  }

  console.log(`\n— done: ${ok} enriched, ${failures.length} failed —`);
  for (const failure of failures) console.log(`    - ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`✖ enrich step failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
