# Recipeace

A cocktail pantry-matching app. Build your bar (the ingredients you own) and
instantly see which cocktails you can make, what you're closest to making, and
what single bottle would unlock the most new recipes.

Built with Next.js 16 (App Router) and Supabase (Postgres + Auth + Storage).

## Architecture

The AI never runs in the request path.

- **Offline pipeline** (`scripts/pipeline/`): an LLM generates recipes, which
  are validated against the canonical ingredient taxonomy and written to
  Postgres with canonical ingredient IDs. Run occasionally by a maintainer
  with the Supabase secret key.
- **Live app**: deterministic SQL only. Matching is done by two Postgres
  functions (`match_recipes`, `recipe_pantry_status`) called over the
  Supabase API. No AI, no per-request inference cost, reproducible results.

Reference data (ingredients, recipes) is world-readable via RLS; user data
(pantry, favorites, profiles) is owner-only.

## The matcher

Given a pantry (array of ingredient IDs), the matcher classifies each required
ingredient of each published recipe:

- **Ancestor hierarchy** — `ingredients.parent_id` forms an is-a tree; owning
  bourbon satisfies a recipe calling for whiskey.
- **Staples** — ingredients flagged `is_staple` (water, ice, salt…) are
  assumed always on hand.
- **Derivations** — `ingredient_derivations` records what an ingredient
  physically yields: owning an orange counts as exactly having orange peel and
  orange juice (recursive, one-way — a peel doesn't grant a whole orange).
- **Substitutions** — `ingredient_substitutions` are looser "in a pinch"
  swaps, applied one hop in either direction and reported separately from
  exact coverage.
- **Ranking** — recipes are ordered by fewest missing ingredients, then fewest
  substitutions. Recipes the pantry covers nothing of are never returned, and
  `max_missing` defaults to 2 (pass `null` for all recipes with any overlap).
  The names of missing ingredients are returned so the UI can show exactly
  what to buy.

## Pantry & accounts

The pantry is anonymous-first: it lives in `localStorage` until you sign in,
then migrates automatically into the `pantry_items` table on the first
signed-in auth event (email/password and Google OAuth alike). Favorites are
account-only. Auth uses `@supabase/ssr` with a proxy (`src/proxy.ts`)
refreshing the session cookie on every request.

## Local setup

```bash
npm install
supabase start                 # local Postgres + Auth + Storage
supabase db reset              # applies migrations + supabase/seed.sql (taxonomy)
npm run dev
```

`supabase/seed.sql` is generated from `src/data/cocktail-seed.ts` via
`npm run generate:seed` — edit the TypeScript, not the SQL. For a handful of
test recipes without running the pipeline, execute
`supabase/seed_test_recipes.sql` against the local database.

Environment variables (`.env.local`):

| Variable                               | Used by         | Purpose                                        |
| -------------------------------------- | --------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | app + pipeline  | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app             | public API key (RLS applies)                   |
| `SUPABASE_SECRET_KEY`                  | pipeline only   | bypasses RLS to write content                  |
| `ANTHROPIC_API_KEY`                    | pipeline        | recipe generation (default provider)           |
| `OPENAI_TEXT_API_KEY`                  | pipeline        | recipe generation with `--provider openai`     |
| `OPENAI_IMAGE_API_KEY`                 | pipeline:images | optional; without it a placeholder SVG is used |

## Content pipeline

```bash
npm run pipeline -- --count 8             # generate, validate, dedup, ingest
npm run pipeline -- --count 12 --dry-run  # generate and validate only
npm run pipeline -- --provider openai     # or PIPELINE_PROVIDER=openai
npm run pipeline:images                   # backfill images for recipes missing one (idempotent)
```

## Google OAuth setup (manual)

"Continue with Google" requires one-time Supabase dashboard configuration:
enable the Google provider (Authentication → Providers) with an OAuth client
ID and secret from Google Cloud Console, and add your site's
`/auth/callback` URL to the allowed redirect URLs (Authentication → URL
Configuration). Password-reset emails likewise need the site URL configured
so the `/auth/reset` link points at your deployment.
