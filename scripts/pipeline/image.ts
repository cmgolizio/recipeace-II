// The image-generation step (offline only — never the request path).
//
// generateImage() uses the OpenAI Images API when OPENAI_IMAGE_API_KEY is set,
// and falls back to a deterministic, key-free SVG placeholder otherwise. The
// key is read only here, in a script you run manually — it is never imported by
// the app, an API route, a server action, or the client bundle.

import OpenAI from "openai";
import { z } from "zod";

export type RecipeImageInput = {
  name: string;
  description?: string | null;
  method?: string | null;
  glass?: string | null;
  garnish?: string | null;
};

export type GeneratedImage = {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
};

/** Which mode the next generateImage() call will use, for logging. */
export function imageMode(): string {
  return process.env.OPENAI_IMAGE_API_KEY
    ? `OpenAI (${process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1"})`
    : "SVG placeholder — OPENAI_IMAGE_API_KEY not set";
}

export async function generateImage(
  recipe: RecipeImageInput,
): Promise<GeneratedImage> {
  if (process.env.OPENAI_IMAGE_API_KEY) return openAiImage(recipe);
  return placeholderImage(recipe);
}

// ── OpenAI ──────────────────────────────────────────────────────────────────
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
const SIZE = z
  .enum(["1024x1024", "1024x1536", "1536x1024", "auto"])
  .catch("1024x1024")
  .parse(process.env.OPENAI_IMAGE_SIZE);

// Validate the external response before trusting it.
const ImageResponse = z.object({
  data: z
    .array(z.object({ b64_json: z.string().optional(), url: z.string().optional() }))
    .min(1),
});

function buildPrompt(recipe: RecipeImageInput): string {
  return [
    `A professional, appetizing studio photograph of a "${recipe.name}" cocktail`,
    recipe.glass ? `served in a ${recipe.glass} glass` : null,
    recipe.garnish ? `garnished with ${recipe.garnish}` : null,
    "photorealistic, soft natural lighting, shallow depth of field, clean light " +
      "neutral background, centered composition, no text and no watermark",
  ]
    .filter(Boolean)
    .join(", ") + ".";
}

async function openAiImage(recipe: RecipeImageInput): Promise<GeneratedImage> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_IMAGE_API_KEY,
    timeout: 120_000,
    maxRetries: 2,
  });
  const prompt = buildPrompt(recipe);
  console.log(`    prompt: ${prompt}`);

  const result = await client.images.generate({ model: MODEL, prompt, size: SIZE, n: 1 });
  const item = ImageResponse.parse(result).data[0];

  let bytes: Uint8Array;
  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`fetching generated image failed: HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    throw new Error("OpenAI returned neither b64_json nor url");
  }

  return { bytes, contentType: "image/png", ext: "png" };
}

// ── Placeholder SVG (no API key) ────────────────────────────────────────────
function hashHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h % 360;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function placeholderImage(recipe: RecipeImageInput): GeneratedImage {
  const h1 = hashHue(recipe.name);
  const h2 = (h1 + 40) % 360;
  const title = escapeXml(
    recipe.name.length > 28 ? `${recipe.name.slice(0, 27)}…` : recipe.name,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h1} 58% 46%)"/>
      <stop offset="1" stop-color="hsl(${h2} 52% 28%)"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <g fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    <path d="M280 300 L520 300 L400 442 Z" fill="rgba(255,255,255,0.12)"/>
    <line x1="400" y1="442" x2="400" y2="560"/>
    <line x1="344" y1="563" x2="456" y2="563"/>
  </g>
  <circle cx="436" cy="332" r="13" fill="rgba(255,255,255,0.85)"/>
  <text x="400" y="678" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" fill="white">${title}</text>
</svg>`;
  return { bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml", ext: "svg" };
}