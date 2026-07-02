// Image step: backfill an image for every recipe that doesn't have one yet.
// Idempotent — rerun any time; recipes that already have an image_url are
// skipped. Run with: npm run pipeline:images
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Set
// OPENAI_IMAGE_API_KEY to generate real images via OpenAI; without it, a
// key-free SVG placeholder is used (and logged). Each recipe is isolated, so
// one failure doesn't abort the batch.

import {
  createAdminClient,
  ensureImageBucket,
  loadRecipesMissingImages,
  setRecipeImageUrl,
  uploadRecipeImage,
} from "./db.ts";
import { generateImage, imageMode } from "./image.ts";

async function main(): Promise<void> {
  const admin = createAdminClient();

  console.log(`▶ image source: ${imageMode()}`);
  console.log("▶ ensuring the recipe-images bucket exists…");
  await ensureImageBucket(admin);

  const recipes = await loadRecipesMissingImages(admin);
  console.log(`▶ ${recipes.length} recipe(s) need an image`);

  let ok = 0;
  const failures: string[] = [];

  for (const recipe of recipes) {
    const started = Date.now();
    try {
      const image = await generateImage(recipe);
      const path = `${recipe.slug}.${image.ext}`;
      const url = await uploadRecipeImage(admin, path, image.bytes, image.contentType);
      await setRecipeImageUrl(admin, recipe.id, url);
      ok++;
      console.log(
        `  ✓ ${recipe.name} — ${(image.bytes.length / 1024).toFixed(0)} KB in ${Date.now() - started} ms`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${recipe.name}: ${message}`);
      console.error(`  ✗ ${recipe.name} — ${message} (${Date.now() - started} ms)`);
    }
  }

  console.log(`\n— done: ${ok} generated, ${failures.length} failed —`);
  for (const failure of failures) console.log(`    - ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(`✖ image step failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});