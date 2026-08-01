# RecipeAce

A pantry-matching app for food and drink. Add what you have and see what you
can make, what you're closest to making, and what one ingredient would unlock
the most.

One pantry answers two surfaces:

- **The Bar** (`/bar`) — cocktails, filtered by method, glass, base spirit and
  flavour.
- **The Kitchen** (`/kitchen`) — food, filtered by course, cuisine, total time
  and difficulty.

Built with Next.js 16 (App Router) and Supabase (Postgres + Auth + Storage).

## Architecture

Bar and Kitchen are interface contexts over shared data, not separate systems.
One Supabase project, one ingredient catalog, one pantry, one matcher, one
favorites table, one shopping list. A recipe's domain is persisted in exactly
one place — `recipes.domain` — and everything else derives it by joining.
Metadata that belongs to only one domain lives in `cocktail_recipe_details` or
`food_recipe_details`; the catalog views `cocktail_recipes` and `food_recipes`
flatten each back onto the shared fields for browsing.

The AI never runs in the request path.

- **Offline pipeline** (`scripts/pipeline/`): a shared lifecycle with a domain
  adapter at each end. `domains/cocktail/` generates drinks with an LLM and
  writes them with the Supabase secret key; `domains/food/` validates the
  curated catalog in `src/data/food-seed.ts` and compiles it to idempotent SQL.
  Both stamp their domain explicitly.
- **Live app**: deterministic SQL only. Matching is Postgres functions
  (`match_recipes`, `match_recipes_detail`, `recipe_pantry_status`,
  `search_recipes`) called over the Supabase API. No AI, no per-request
  inference cost, reproducible results.

Reference data (ingredients, recipes) is world-readable via RLS; user data
(pantry, favorites, profiles) is owner-only.

The expansion from cocktails-only to both domains is documented phase by phase
in `docs/expansion-plan.md` and `docs/expansion-inventory.md`.

## The matcher

One matcher serves both domains: `match_recipes(pantry, max_missing, domain)`
filters candidates by domain and changes nothing else. Given a pantry (array of
ingredient IDs), it classifies each required ingredient of each published
recipe:

- **Ancestor hierarchy** — `ingredients.parent_id` forms an is-a tree; owning
  bourbon satisfies a recipe calling for whiskey.
- **Staples** — ingredients flagged `is_staple` (water, ice, crushed ice,
  sugar, salt) are assumed always on hand, in both domains. The set is
  deliberately tiny — flour and pepper are *not* staples — and the matches
  pages say what it is.
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
`npm run generate:seed`, and `supabase/seed_food.sql` from
`src/data/food-seed.ts` via `npm run pipeline:food` — edit the TypeScript, not
the SQL. Apply both after the migrations. For a handful of test cocktails
without running the generation pipeline, execute
`supabase/seed_test_recipes.sql` against the local database.

Environment variables (`.env.local`):

| Variable                               | Used by         | Purpose                                                                                                                                                      |
| -------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | app + pipeline  | Supabase project URL                                                                                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app             | public API key (RLS applies)                                                                                                                                 |
| `NEXT_PUBLIC_SITE_URL`                 | app             | absolute origin for canonical URLs, OG images, sitemap and robots (set to the production URL in the deploy environment; defaults to `http://localhost:3000`) |
| `SUPABASE_SECRET_KEY`                  | pipeline only   | bypasses RLS to write content                                                                                                                                |
| `ANTHROPIC_API_KEY`                    | pipeline        | recipe generation (default provider)                                                                                                                         |
| `OPENAI_TEXT_API_KEY`                  | pipeline        | recipe generation with `--provider openai`                                                                                                                   |
| `OPENAI_IMAGE_API_KEY`                 | pipeline:images | optional; without it a placeholder SVG is used                                                                                                               |
| `NEXT_PUBLIC_SENTRY_DSN`               | app             | optional; error monitoring. Without it Sentry is never initialized and nothing is sent                                                                       |
| `SENTRY_ORG`, `SENTRY_PROJECT`         | build           | optional; source-map upload target                                                                                                                           |
| `SENTRY_AUTH_TOKEN`                    | build           | optional; enables source-map upload. Builds without it skip the upload                                                                                       |

## Content pipeline

```bash
npm run pipeline -- --count 8             # generate, validate, dedup, ingest
npm run pipeline -- --count 12 --dry-run  # generate and validate only
npm run pipeline -- --provider openai     # or PIPELINE_PROVIDER=openai
npm run pipeline:images                   # backfill images for recipes missing one (idempotent)
npm run pipeline:enrich                   # backfill strength/difficulty/tags/base spirit (idempotent)

npm run pipeline:food -- --dry-run        # validate the curated food catalog and report
npm run pipeline:food                     # write supabase/seed_food.sql
```

The food adapter validates before it writes anything: unresolved ingredients,
duplicate slugs, missing licences, implausible times or servings all fail the
run and print why. Food recipes land unpublished unless the catalog explicitly
publishes them.

## Offline & installability

The app ships a web manifest (`src/app/manifest.ts`) and a hand-written
service worker (`public/sw.js`, registered in production only by
`src/components/register-service-worker.tsx`). The worker precaches the app
shell and serves recipe detail pages stale-while-revalidate, so a previously
visited recipe opens offline. Pantry-, auth- and query-dependent routes
(`/bar/matches`, `/kitchen/matches`, `/favorites`, `/shopping`, `/search`,
`/login`, `/auth/*`, the filtered catalogs) are deliberately never cached. Bump `VERSION` in `public/sw.js` to
invalidate every cache on the next deploy.

## Analytics & monitoring

Page views go to Vercel Analytics (`<Analytics/>` in the root layout — no
configuration beyond deploying on Vercel), plus a handful of custom events via
`src/lib/analytics.ts`, each tagged with the domain it happened in rather than
split into per-domain event names. Errors go to Sentry: client, server
and edge runtimes are initialized from `sentry.*.config.ts` and
`src/instrumentation*.ts`, and the root `error.tsx` boundary reports what it
catches. Both are inert without the env vars above.

## Google OAuth setup (manual)

"Continue with Google" requires one-time Supabase dashboard configuration:
enable the Google provider (Authentication → Providers) with an OAuth client
ID and secret from Google Cloud Console, and add your site's
`/auth/callback` URL to the allowed redirect URLs (Authentication → URL
Configuration). Password-reset emails likewise need the site URL configured
so the `/auth/reset` link points at your deployment.
