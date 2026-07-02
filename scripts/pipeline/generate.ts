// Step 1 of the pipeline: generate cocktail recipes constrained to the seeded
// ingredient vocabulary. Offline only — never called in the request path.
//
// Two providers share the same system prompt, user prompt, and JSON schema;
// only the API call differs. Select with --provider (or PIPELINE_PROVIDER):
//   "anthropic" (default) — Claude, forced tool use
//   "openai"              — OpenAI Chat Completions, strict structured outputs
// Everything downstream (validate / dedup / ingest) is provider-agnostic.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { GeneratedRecipe } from "./validate.ts";

export type Provider = "anthropic" | "openai";
export type VocabularyEntry = { name: string; category: string };

export type GenerateOptions = {
  provider: Provider;
  count: number;
  vocabulary: VocabularyEntry[];
  avoidNames: string[];
  model: string;
};

const SYSTEM = `You are an expert bartender compiling a reference of classic and \
modern-classic cocktails. Produce accurate, well-balanced, genuinely recognized \
recipes — the kind found in respected cocktail books — not invented novelties. \
Every recipe must be correctly proportioned and actually makeable.`;

// Strict-compatible JSON schema: additionalProperties:false on every object and
// every property listed in `required` (nullable via type unions). Valid both as
// an OpenAI strict structured-output schema and as an Anthropic tool schema.
const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "The cocktail's common name" },
          description: { type: "string", description: "One short sentence about the drink" },
          glass: { type: "string", description: "Serving glass, e.g. coupe, rocks, highball" },
          method: { type: "string", description: "shaken, stirred, built, blended, etc." },
          garnish: { type: "string", description: "Short garnish description" },
          instructions: {
            type: "array",
            items: { type: "string" },
            description: "Ordered preparation steps (3-6)",
          },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: {
                  type: "string",
                  description: "MUST be one of the provided ingredient names, spelled exactly",
                },
                amount: { type: ["number", "null"], description: "Quantity in the given unit" },
                unit: { type: ["string", "null"], description: "e.g. oz, dash, barspoon, each" },
                optional: { type: "boolean", description: "true if non-essential" },
                garnish: { type: "boolean", description: "true if this is a garnish" },
              },
              required: ["name", "amount", "unit", "optional", "garnish"],
            },
          },
        },
        required: ["name", "description", "glass", "method", "garnish", "instructions", "ingredients"],
      },
    },
  },
  required: ["recipes"],
};

function buildVocabulary(vocabulary: VocabularyEntry[]): string {
  const byCategory = new Map<string, string[]>();
  for (const entry of vocabulary) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry.name);
    byCategory.set(entry.category, list);
  }
  return [...byCategory.entries()]
    .map(([category, names]) => `${category}: ${[...names].sort().join(", ")}`)
    .join("\n");
}

function buildUserPrompt(opts: GenerateOptions): string {
  return [
    `Generate ${opts.count} distinct, well-known cocktails.`,
    opts.avoidNames.length > 0
      ? `Do NOT repeat any of these existing recipes: ${opts.avoidNames.join(", ")}.`
      : "",
    "",
    "Use ONLY ingredients from this vocabulary, spelled exactly as written " +
      "(including accents). If a cocktail would need something not listed, pick a " +
      "different cocktail. Assume ice and water are on hand — do not list them.",
    "",
    buildVocabulary(opts.vocabulary),
    "",
    "For each recipe give: name, a one-sentence description, glass, method, a short " +
      "garnish, 3-6 instruction steps, and an ingredient list. For each ingredient " +
      "give the amount as a number, a unit (oz, dash, barspoon, each, …), and set " +
      "garnish:true for garnishes and optional:true for non-essential items. Keep " +
      "ingredient lists tight (typically 3-6).",
  ].join("\n");
}

export async function generateRecipes(opts: GenerateOptions): Promise<GeneratedRecipe[]> {
  const userPrompt = buildUserPrompt(opts);
  return opts.provider === "openai"
    ? generateOpenAI(opts.model, userPrompt)
    : generateAnthropic(opts.model, userPrompt);
}

async function generateAnthropic(model: string, userPrompt: string): Promise<GeneratedRecipe[]> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const message = await client.messages.create({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    tools: [
      {
        name: "emit_recipes",
        description: "Return the generated cocktail recipes.",
        input_schema: RECIPE_SCHEMA as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "emit_recipes" },
    messages: [{ role: "user", content: userPrompt }],
  });
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) throw new Error("Anthropic did not return the emit_recipes tool call");
  return (toolUse.input as { recipes?: GeneratedRecipe[] }).recipes ?? [];
}

async function generateOpenAI(model: string, userPrompt: string): Promise<GeneratedRecipe[]> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_TEXT_API_KEY,
    timeout: 120_000,
    maxRetries: 2,
  });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cocktail_recipes",
        schema: RECIPE_SCHEMA as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const message = completion.choices[0]?.message;
  if (message?.refusal) throw new Error(`OpenAI refused: ${message.refusal}`);
  if (!message?.content) throw new Error("OpenAI returned no content");
  return (JSON.parse(message.content) as { recipes?: GeneratedRecipe[] }).recipes ?? [];
}