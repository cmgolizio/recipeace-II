# What's In House

A pantry-matching app for food and drink. Add what you have and see what you
can make, what you're closest to making, and what one ingredient would unlock
the most.

One pantry answers two workspaces:

- **The Bar** (`/bar`) — cocktails, filtered by method, glass, base spirit and
  flavour.
- **The Kitchen** (`/kitchen`) — food, filtered by course, cuisine, total time
  and difficulty.

`/` is the chooser between them; `/pantry` is the combined list, which belongs
to neither side.

Built with Next.js 16 (App Router) and Supabase (Postgres + Auth + Storage).

The product name lives in `src/lib/site.ts` and nowhere else — page titles,
the manifest, the Open Graph image and the header wordmark all read it from
there.

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
  deliberately tiny — flour and pepper are _not_ staples — and the matches
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

## One pantry, two workspaces

There is one pantry store, one `pantry_items` table and one localStorage key.
Bar and Kitchen are **lenses over it**, never separate inventories: lime juice
is one row whichever side you are standing on, and adding an ingredient counts
towards a drink and towards dinner at the same time.

| Route                              | What it is                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `/`                                | the chooser — two cards, each with that side's counts                       |
| `/pantry`                          | the combined list; belongs to neither side                                  |
| `/bar`, `/kitchen`                 | the working surfaces: add ingredients, see this side's shelf, go to matches |
| `/bar/matches`, `/kitchen/matches` | one matcher, one ranking, per domain                                        |
| `/bar/recipes`, `/kitchen/recipes` | catalog browsers, with each domain's own facets                             |

`/recipes` and `/matches` still 307 to their `/bar` equivalents, query strings
preserved.

**The lens.** `src/lib/pantry/lens.ts` maps each `ingredient_category` to the
side(s) it reads as — `spirit` is the Bar, `meat` the Kitchen, `produce` both.
It is presentation only: the matcher never sees it, and `ingredients.category`
stays domain-agnostic in the schema. Two rules follow from it:

- On a domain surface the shelf shows that side's ingredients, and the rest sit
  in a collapsed "Also in your pantry" group. Collapsed, never hidden — the
  other side must stay visible for the pantry to read as one store.
- Ingredient search **groups, never filters**. Typing "egg" in the Bar still
  finds eggs; a flip needs them. Domain context ranks results, it never removes
  them.

The map is static rather than derived from `recipe_ingredients ⋈
recipes.domain` on purpose: at 13 food recipes a derived Kitchen shelf would be
almost empty. Revisit when the food catalog passes ~100 published recipes — the
derived design is written up in `docs/restructure-plan.md` Appendix B.

**Domain-parameterized components, not Bar/Kitchen twins.** Every component
that differs by side takes a `domain` prop and reads its words from
`src/lib/recipes/domain.ts` (`DOMAIN_SURFACE`, `DOMAIN_SHELF`,
`DOMAIN_MATCH_CTA`, `DOMAIN_ROUTES`, …). There is one `MatchesView`, one
`PantryPanel`, one `IngredientSearch`. Copy that varies by domain lives in
`domain.ts` as a `Record<RecipeDomain, string>`, never as an inline ternary.

Colour is orientation, not information: `.domain-bar` and `.domain-kitchen`
rebind `--accent` for their subtree, so every `bg-accent` / `text-accent`
follows automatically — but the heading, layout and copy have to distinguish
the two sides in a greyscale screenshot on their own.

**Adding a third domain** would be: add the value to the `recipe_domain` enum
and a details table for its own metadata; add it to `RECIPE_DOMAINS` and to
every `Record<RecipeDomain, …>` in `domain.ts` (TypeScript will name each one
you miss); classify every `ingredient_category` for it in `lens.ts` (the
`Record<IngredientCategory, …>` is exhaustive on purpose, so this also fails to
compile until it is done); add the route subtree with its own layout and accent
tokens; and pass the new domain to the components that already take one. No
matcher change: `match_recipes(p_domain)` filters candidates and nothing else.

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
supabase db reset              # applies migrations, then the seeds
npm run dev
```

`db reset` applies every migration and then each seed listed under
`[db.seed] sql_paths` in `supabase/config.toml` — the taxonomy, the food
catalog, and a handful of stub cocktails for local use. That is the same
schema and data the tests build in-process (`tests/db.ts`).

`supabase/seed.sql` is generated from `src/data/cocktail-seed.ts` via
`npm run generate:seed`, and `supabase/seed_food.sql` from
`src/data/food-seed.ts` via `npm run pipeline:food` — edit the TypeScript, not
the SQL.

To ship schema changes to a hosted project, link the clone once
(`supabase link --project-ref <ref>`) and then `supabase db push`. The link
lives in `supabase/.temp/`, which is machine-local and gitignored. Seeds are
not part of `db push`; see `docs/expansion-rollout.md` §9. Never run
`supabase db reset --linked` against a hosted project — it drops the data.

Environment variables (`.env.local`):

| Variable                               | Used by         | Purpose                                                                                |
| -------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | app + pipeline  | Supabase project URL                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app             | public API key (RLS applies)                                                           |
| `SUPABASE_SECRET_KEY`                  | pipeline only   | bypasses RLS to write content                                                          |
| `ANTHROPIC_API_KEY`                    | pipeline        | recipe generation (default provider)                                                   |
| `OPENAI_TEXT_API_KEY`                  | pipeline        | recipe generation with `--provider openai`                                             |
| `OPENAI_IMAGE_API_KEY`                 | pipeline:images | optional; without it a placeholder SVG is used                                         |
| `NEXT_PUBLIC_SENTRY_DSN`               | app             | optional; error monitoring. Without it Sentry is never initialized and nothing is sent |
| `SENTRY_ORG`, `SENTRY_PROJECT`         | build           | optional; source-map upload target                                                     |
| `SENTRY_AUTH_TOKEN`                    | build           | optional; enables source-map upload. Builds without it skip the upload                 |

The absolute origin for canonical URLs, OG images, sitemap and robots is **not**
an environment variable. It is a constant in `src/lib/site-url.ts`, branching on
`NODE_ENV` so `next dev` serves from `http://localhost:3000` and every built
deploy serves the production origin. A canonical origin held in a deploy
dashboard has no reviewer and drifts silently, which is exactly what happened
across the rename (`docs/ux-plan.md` audit finding 7). Change the domain by
editing that file.

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
(`/pantry`, `/bar`, `/kitchen`, `/bar/matches`, `/kitchen/matches`,
`/favorites`, `/shopping`, `/search`, `/login`, `/auth/*`, the filtered
catalogs) are deliberately never cached — editing the pantry offline is not
offered. Bump `VERSION` in `public/sw.js` to invalidate every cache on the next
deploy.

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
