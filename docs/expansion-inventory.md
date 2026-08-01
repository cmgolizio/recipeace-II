# Expansion Inventory — Phase 0 Baseline

> **File:** `docs/expansion-inventory.md`
> **Phase:** 0 — Establish baseline and expansion inventory (see `docs/expansion-plan.md` §25)
> **Status:** complete. No application code, schema, or data was changed in this phase.
>
> This document records the state of the repository _before_ the food expansion
> begins. It is the reference every later phase checks its assumptions against.
> When a later phase changes something described here, update the relevant
> section rather than letting this drift.

---

## 1. How this was produced

Every file listed in the plan's required inspection list was read directly:
all 15 migrations, the hand-authored database types, every recipe/pantry query
entry point, the matcher SQL, all route files, all components that touch the
database, the client stores, the full ingestion pipeline, the RLS policies, the
test harness, and the CI configuration.

Baseline validation was run against the repository as found (commit `f6471a7`):

| Check | Command            | Result                        |
| ----- | ------------------ | ----------------------------- |
| Lint  | `npm run lint`     | pass, no output               |
| Build | `npm run build`    | pass — 17 pages, 2 SSG routes |
| Types | `npx tsc --noEmit` | pass                          |
| Tests | `npm test`         | pass — 6 files, 35 tests      |

These four commands are the phase gate for every later phase. A phase that
breaks any of them is not complete.

---

## 2. Current architecture summary

One Next.js 16 App Router application on React 19, one Supabase project
(Postgres + Auth + Storage), one `public` schema. Deployment is Vercel;
observability is Sentry plus Vercel Analytics.

The defining architectural decision is that **the AI never runs in the request
path**. An offline pipeline (`scripts/pipeline/`) generates recipes with an LLM,
validates them against the canonical ingredient taxonomy, and writes them to
Postgres using the Supabase secret key. The live application executes only
deterministic SQL — matching is seven Postgres functions called over the
Supabase API.

Data flow:

```
src/data/cocktail-seed.ts  →  npm run generate:seed  →  supabase/seed.sql  →  ingredients/aliases/substitutions/derivations
LLM (offline)              →  validate.ts            →  db.ts ingestRecipe  →  recipes/recipe_ingredients
pantry_items (or localStorage)  →  match_recipes RPC  →  /matches
```

Reference and content data is world-readable through RLS with no write policies
at all — writes happen only through the secret key, which bypasses RLS. User
data (`profiles`, `pantry_items`, `favorite_recipes`) is owner-only.

---

## 3. Repository inventory

### 3.1 Recipe schema

`public.recipes` — one table, 16 columns, no domain concept anywhere.

| Column                      | Type                          | Classification for the expansion                                                                                                                          |
| --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | bigint identity PK            | shared                                                                                                                                                    |
| `slug`                      | text not null unique          | shared                                                                                                                                                    |
| `name`                      | text not null                 | shared                                                                                                                                                    |
| `description`               | text                          | shared                                                                                                                                                    |
| `instructions`              | text[] not null default `{}`  | **shared** — ordered steps already; no separate table needed for food                                                                                     |
| `source`                    | text                          | shared (currently only ever `'ai-generated'`)                                                                                                             |
| `is_published`              | boolean not null default true | shared                                                                                                                                                    |
| `image_url`                 | text                          | shared                                                                                                                                                    |
| `created_at` / `updated_at` | timestamptz                   | shared (`updated_at` maintained by trigger)                                                                                                               |
| `method`                    | text                          | **cocktail-specific** — shaken / stirred / built                                                                                                          |
| `glass`                     | text                          | **cocktail-specific**                                                                                                                                     |
| `garnish`                   | text                          | **cocktail-specific** free text                                                                                                                           |
| `strength`                  | smallint                      | **cocktail-specific** — estimated ABV %                                                                                                                   |
| `base_spirit`               | text                          | **cocktail-specific**                                                                                                                                     |
| `flavor_tags`               | text[] not null default `{}`  | **cocktail-specific vocabulary** — the 11 tags in `scripts/pipeline/validate.ts` are drink-flavor words; the _column_ is generic, the _vocabulary_ is not |
| `difficulty`                | enum `recipe_difficulty`      | **shared** — `easy`/`medium`/`advanced` applies to food unchanged                                                                                         |

Indexes: `recipes_name_trgm_idx` (gin trigram), `recipes_published_idx`,
`recipes_flavor_tags_idx` (gin), `recipes_base_spirit_idx`.

Five of the six cocktail-specific fields (`method`, `glass`, `garnish`,
`strength`, `base_spirit`) sit directly on `recipes`. This is what Phase 5 has
to resolve.

### 3.2 Ingredient schema

`public.ingredients` — 160 canonical rows in the seed.

| Column      | Notes                                                    |
| ----------- | -------------------------------------------------------- |
| `id`        | bigint identity PK                                       |
| `name`      | text not null unique                                     |
| `slug`      | text not null unique, derived via `public.slugify(name)` |
| `category`  | enum `ingredient_category`, not null                     |
| `parent_id` | self-reference — an _is-a_ hierarchy (bourbon → whiskey) |
| `is_staple` | boolean, "assumed always on hand"                        |

`ingredient_category` enum values and seeded counts:

| Value            | Count | Food-relevant?                     |
| ---------------- | ----- | ---------------------------------- |
| `liqueur`        | 33    | no                                 |
| `spirit`         | 31    | no                                 |
| `garnish`        | 18    | cocktail role, not a food category |
| `produce`        | 13    | yes                                |
| `fortified_wine` | 13    | no                                 |
| `syrup`          | 9     | partly                             |
| `juice`          | 8     | partly                             |
| `other`          | 7     | catch-all                          |
| `mixer`          | 7     | no                                 |
| `wine`           | 6     | partly                             |
| `staple`         | 5     | overlaps the `is_staple` boolean   |
| `dairy`          | 5     | yes                                |
| `bitters`        | 5     | no                                 |

Only `produce`, `dairy` and the catch-all `other` transfer to food. This enum is
the single most cocktail-shaped structure in the schema and is Phase 6's whole
subject. Note also that `staple` exists as _both_ an enum value and a boolean
column — two representations of one idea, worth resolving in Phase 6.

Supporting tables, all shared and all correctly domain-free:

- `ingredient_aliases` — `alias` unique → `ingredient_id`. Trigram-indexed.
- `ingredient_substitutions` — `(ingredient_id, substitute_id)` unique, optional
  `note`. Treated **bidirectionally** by the matcher; no direction, quality, or
  context metadata.
- `ingredient_derivations` — one-way `source_id → derived_id`. Owning the source
  counts as _exactly_ having the derived item. Currently only zero-effort
  physical transformations (orange → orange twist, lime → lime juice).

### 3.3 Recipe–ingredient relationship

`public.recipe_ingredients`:

| Column                       | Notes                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `recipe_id`, `ingredient_id` | FKs; `ingredient_id` is `on delete restrict`                                 |
| `amount`                     | numeric, nullable                                                            |
| `unit`                       | text, **free-form** — no controlled vocabulary                               |
| `preparation`                | text ("freshly squeezed", "muddled") — always `null` from the pipeline today |
| `is_optional`                | boolean — the matcher ignores these                                          |
| `is_garnish`                 | boolean — a cocktail _role_ flag                                             |
| `display_order`              | integer                                                                      |
| `raw_text`                   | text — provenance of the original generated line                             |
| **constraint**               | `unique (recipe_id, ingredient_id)`                                          |

This table is already much closer to food-ready than the plan assumes
(quantity, unit, preparation, optionality, and display order all exist). Two
gaps: there is no recipe _section_, and the unique constraint forbids the same
ingredient appearing twice in one recipe.

### 3.4 User-owned tables and RLS

| Table                      | RLS | Select                           | Insert   | Update  | Delete   |
| -------------------------- | --- | -------------------------------- | -------- | ------- | -------- |
| `profiles`                 | on  | own row                          | own row  | own row | —        |
| `pantry_items`             | on  | own rows                         | own rows | —       | own rows |
| `favorite_recipes`         | on  | own rows                         | own rows | —       | own rows |
| `ingredients`              | on  | everyone                         | —        | —       | —        |
| `ingredient_aliases`       | on  | everyone                         | —        | —       | —        |
| `ingredient_substitutions` | on  | everyone                         | —        | —       | —        |
| `ingredient_derivations`   | on  | everyone                         | —        | —       | —        |
| `recipes`                  | on  | `is_published` only              | —        | —       | —        |
| `recipe_ingredients`       | on  | ingredients of published recipes | —        | —       | —        |

Every user policy wraps `auth.uid()` in a sub-select, per Supabase performance
guidance. No content table has a write policy — that is deliberate, not an
oversight: the pipeline writes with the secret key.

**Unpublished recipes are already invisible to anonymous and authenticated
clients.** This is the mechanism Phase 9 will use to stage food recipes before
review.

### 3.5 Database functions

All seven are `stable`, `security invoker`, `set search_path = ''`, and granted
to `anon, authenticated`.

| Function                                      | Purpose                                          | Domain-blind?                                                      |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `match_recipes(pantry, max_missing=2)`        | Rank published recipes by pantry coverage        | needs a domain filter                                              |
| `match_recipes_detail(pantry, max_missing=2)` | `match_recipes` + card fields + ingredient jsonb | **returns `method`, `glass`** — cocktail fields in the signature   |
| `recipe_pantry_status(recipe_id, pantry)`     | Per-ingredient have/substitute/missing           | domain-agnostic already                                            |
| `search_ingredients(q, max_results=10)`       | Trigram autocomplete over names + aliases        | **returns `ingredient_category`**                                  |
| `popular_ingredients(max_results=8)`          | Starter suggestions                              | **hardcodes `i.category <> 'garnish'`**                            |
| `related_recipes(recipe_id, max_results=4)`   | "More like this"                                 | **hardcodes `i.category <> 'garnish'`** and ranks on `base_spirit` |
| `ingredient_detail(slug)`                     | Everything the ingredient page renders           | **returns `ingredient_category`**                                  |
| `slugify(text)`                               | Canonical name → URL slug                        | shared                                                             |

### 3.6 The matching algorithm

`match_recipes` (current version: `20260702120100_match_recipes_derivations.sql`)

1. **Ancestor expansion** — recursive walk up `parent_id` from the owned ids.
2. **Staples** — union in every ingredient where `is_staple`.
3. **Derivation expansion** — recursively expand through
   `ingredient_derivations` edges _interleaved with_ ancestor edges. Result: the
   "exact set".
4. **Substitution reach** — one hop, in either direction, from the exact set.
5. **Required set** — `recipe_ingredients` where `not is_optional`, joined to
   published recipes. Note: `is_garnish` alone does **not** exclude a line;
   seeded garnish rows are flagged both optional and garnish.
6. **Score** — per recipe: `required_count`, `exact_count`, `substitute_count`,
   `missing_count`, plus `missing_ingredients` names.
7. **Filter** — recipes with zero overlap are never returned; `max_missing`
   defaults to 2.
8. **Order** — `missing_count`, `substitute_count`, `required_count`,
   `recipe_id`.

Matching is **presence-based**, not quantity-aware. `recipe_pantry_status`
mirrors the same expansion per-ingredient and additionally reports
`derived_from` provenance.

### 3.7 Route map

_Updated in phase 4: the cocktail catalog and matches moved under `/bar`._

| Route                                                                      | Rendering                    | Data source                                                                          |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `/`                                                                        | static; client islands       | `search_ingredients`, `popular_ingredients`, `ingredients`, `match_recipes_detail`   |
| `/bar`                                                                     | dynamic server               | `recipes` count for the cocktail domain                                              |
| `/bar/recipes` (was `/recipes`)                                            | **dynamic server**           | `recipes` table, offset pagination (24/page) + a second unpaginated facet query      |
| `/bar/matches` (was `/matches`)                                            | **client component**         | `match_recipes_detail`, no pagination                                                |
| `/kitchen`                                                                 | static placeholder           | none yet                                                                             |
| `/recipes/[slug]`                                                          | **SSG**, `revalidate = 3600` | `recipes`, `recipe_ingredients`, `related_recipes`; pantry status in a client island |
| `/ingredients/[slug]`                                                      | **SSG**, `revalidate = 3600` | `ingredient_detail`                                                                  |
| `/favorites`                                                               | client component             | `favorite_recipes` store + `recipes` by id                                           |
| `/shopping`                                                                | client component             | localStorage only                                                                    |
| `/login`, `/auth/reset`, `/auth/callback`                                  | auth                         | Supabase Auth                                                                        |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/opengraph-image` | metadata                     | `recipes`, `ingredients`                                                             |

`/recipes` and `/matches` are 307 redirects to their `/bar` equivalents
(`next.config.mjs`), query strings preserved.

Navigation (`src/components/site-header.tsx`): a Bar/Kitchen domain switcher,
then `pantry` · `favorites` · `shopping`, with a pantry-count badge, theme
toggle, and a mobile overflow menu.

### 3.8 Query entry points

Every place the database is touched. Phase 2 must give each one explicit domain
behavior.

**Recipe reads**

| File                                       | Call                                           |
| ------------------------------------------ | ---------------------------------------------- |
| `src/app/recipes/page.tsx:82`              | `recipes` list, paginated + filtered           |
| `src/app/recipes/page.tsx:114`             | `recipes` facet scan (**every published row**) |
| `src/app/recipes/[slug]/page.tsx:54`       | `recipes.slug` for `generateStaticParams`      |
| `src/app/recipes/[slug]/page.tsx:68`       | one recipe by slug                             |
| `src/app/recipes/[slug]/page.tsx:108`      | `recipe_ingredients` + joined ingredient       |
| `src/app/recipes/[slug]/page.tsx:115`      | `related_recipes` RPC                          |
| `src/app/favorites/page.tsx:53`            | `recipes` by id list                           |
| `src/app/matches/page.tsx:215`             | `match_recipes_detail` RPC                     |
| `src/components/almost-there-nudge.tsx:31` | `match_recipes_detail` RPC                     |
| `src/app/sitemap.ts:24`                    | published recipe slugs                         |

**Ingredient reads**

| File                                        | Call                            |
| ------------------------------------------- | ------------------------------- |
| `src/components/ingredient-search.tsx:41`   | `search_ingredients` RPC        |
| `src/components/ingredient-browse.tsx:53`   | full `ingredients` list         |
| `src/components/pantry-panel.tsx:31`        | `ingredients` by id             |
| `src/components/starter-suggestions.tsx:37` | `popular_ingredients` RPC       |
| `src/app/ingredients/[slug]/page.tsx:34,43` | slugs + `ingredient_detail` RPC |
| `src/app/sitemap.ts:28`                     | ingredient slugs                |

**User-data writes** — `src/lib/pantry/store.ts` (lines 76, 97, 165, 181, 199),
`src/lib/favorites/store.ts` (lines 42, 106, 120).

**Pipeline writes** — `scripts/pipeline/db.ts`: `ingestRecipe` (line 72,
upsert on slug) is the **only** recipe insert path in the application;
`setRecipeImageUrl` (162) and `updateRecipeMetadata` (202) are updates.

### 3.9 Client stores

Three `useSyncExternalStore` modules, all hand-rolled, no state library.

| Store                    | Backing                                                        | Notes                                                                                                                 |
| ------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `lib/pantry/store.ts`    | localStorage `recipeace.pantry.v1` → `pantry_items` on sign-in | anonymous-first; migrates and clears localStorage on the first signed-in event. Also owns the shared `user` snapshot. |
| `lib/favorites/store.ts` | `favorite_recipes` table                                       | signed-in only; optimistic with refetch-on-error rollback                                                             |
| `lib/shopping/store.ts`  | localStorage `recipeace.shopping.v1`                           | **ingredient names, not ids**; no auth listener, no DB backing, no recipe provenance                                  |

The shopping list storing bare names is the main structural gap for Phase 12.

### 3.10 Pipeline flow

`npm run pipeline -- --count N [--dry-run] [--provider openai]`

1. `db.ts loadTaxonomy` — build a normalized name/alias → id resolver, plus the
   vocabulary sent to the model.
2. `db.ts loadExistingRecipes` — slugs (dedup) and names (avoid list).
3. `generate.ts generateRecipes` — one bartender system prompt and one JSON
   schema shared by both providers (Anthropic forced tool use / OpenAI strict
   structured output).
4. `validate.ts validateRecipe` — pure, no I/O. Rejects on missing name, empty
   slug, no instructions, an unresolvable _required_ ingredient, or fewer than
   2 resolved core ingredients. Drops unresolvable optional/garnish lines.
   De-duplicates ingredient ids. Sanitizes metadata against fixed vocabularies.
5. `db.ts ingestRecipe` — upsert on `slug`, then delete-and-reinsert the
   ingredient rows.

Two side pipelines: `images.ts` (generate → upload to the `recipe-images`
bucket → set `image_url`) and `enrich.ts` (backfill metadata where
`difficulty is null`).

Idempotency today rests on the recipe **slug**. Dry-run exists but only prints
a one-line summary per recipe — nothing like the report Phase 8 §16.5 asks for.

### 3.11 Tests

`vitest run`, 6 files, 35 tests, ~11s. `tests/db.ts` builds an **in-process
Postgres (PGlite)** from the real `supabase/migrations/*.sql` in order, then
`seed.sql` and `seed_test_recipes.sql`, with a small shim for the pieces the
Supabase platform provides (the `auth` schema, `auth.uid()`, the `anon` /
`authenticated` roles, the `extensions` schema).

This is the single most valuable asset for the expansion: **every schema change
can be verified locally, with no Supabase project and no network.**

| File                          | Tests | Covers                                                                                                            |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| `matcher.test.ts`             | 7     | derivations, substitutions, staples, zero-overlap exclusion, `max_missing` default, `match_recipes_detail` parity |
| `ingredient-detail.test.ts`   | 8     | `slugify`, slug uniqueness, the detail RPC's four jsonb arrays                                                    |
| `popular-ingredients.test.ts` | 4     | ranking, garnish/staple exclusion, `max_results`                                                                  |
| `related-recipes.test.ts`     | 5     | shared-count ranking, `base_spirit` tiebreak, publication filter                                                  |
| `metadata.test.ts`            | 5     | `sanitizeMetadata` + the metadata columns round-tripping                                                          |
| `units.test.ts`               | 6     | fraction rendering, oz→ml, the serving scaler                                                                     |

No UI/component tests, no route tests, no pipeline end-to-end test.

### 3.12 Build and deploy configuration

CI (`.github/workflows/ci.yml`) on every PR and push to `main`: `npm ci` →
`lint` → `build` → `tsc --noEmit` → `test`. Node 22.

`src/types/database.ts` carries an explicit header stating it is
**hand-authored** and verified by introspection, deliberately shaped like
`supabase gen types typescript` output so it can be swapped later. The plan's
"regenerate database types" instruction (§8.13) therefore means _hand-edit this
file carefully and keep it in the generated shape_ for this repository.

No Supabase CLI and no `.env*` files are present in the working tree, so
migrations cannot be applied to a live project from here. Schema changes are
authored as migration files and verified through PGlite.

---

## 4. Code classification

**Reusable unchanged**

- Auth: `src/proxy.ts`, `src/lib/supabase/{client,server,static,middleware}.ts`,
  `src/lib/auth/store.ts`, `/login`, `/auth/*`, the `profiles` table and trigger.
- `public.slugify`, the `ingredients.slug` scheme, `/ingredients/[slug]`'s
  route shape.
- `src/lib/pantry/store.ts` — one pantry, ids only, no domain. Correct as-is.
- `favorite_recipes` table and RLS — references recipes, no domain duplication.
- Shared chrome: `theme-toggle`, `toast/*`, `skeleton`, `empty-state`,
  `share-button`, `unit-toggle`, `register-service-worker`.
- `tests/db.ts` harness.
- `recipe_pantry_status` — already domain-agnostic.
- `recipes.instructions` as `text[]` — ordered steps serve both domains.

**Reusable with generalization**

- `match_recipes` / `match_recipes_detail` — need a domain parameter and, for
  `_detail`, a domain-neutral projection.
- `search_ingredients`, `ingredient_detail` — signatures expose
  `ingredient_category`; they follow whatever Phase 6 does to the taxonomy.
- `popular_ingredients`, `related_recipes` — need the hardcoded
  `category <> 'garnish'` replaced and domain scoping.
- `/recipes` list query and `RecipeCard` — need a domain filter and composed,
  rather than conditional, metadata.
- `/recipes/[slug]` — one loader, domain-branched detail rendering (Phase 13).
- `recipe_ingredients` — add section support; revisit the unique constraint.
- The pipeline lifecycle (`run.ts` argument parsing, `db.ts` taxonomy loading
  and persistence, the dry-run switch) — shared, with domain adapters beneath.
- `site-header.tsx`, `sitemap.ts`, `layout.tsx` metadata.

**Cocktail-specific (keep, scope to the Bar)**

- `recipes.method`, `glass`, `garnish`, `strength`, `base_spirit`, and the
  `FLAVOR_TAGS` vocabulary.
- `recipe_ingredients.is_garnish`.
- The `spirit`/`liqueur`/`fortified_wine`/`wine`/`bitters`/`mixer`/`garnish`
  ingredient categories.
- `scripts/pipeline/generate.ts` — the bartender system prompt and recipe schema.
- `src/data/cocktail-seed.ts` and the generated `supabase/seed.sql`.
- `recipes-filter.tsx` (method/glass/spirit/flavor facets).
- `almost-there-nudge.tsx`, `starter-suggestions.tsx` ("bottles worth buying").
- All "bar" copy across the UI.

**Obsolete**

- Nothing. No dead code was found.

**Unknown / needs a product decision**

- `src/lib/shopping/store.ts` — names-only, localStorage-only. Phase 12 wants
  domain grouping and recipe provenance, which this shape cannot express.
- The `staple` ingredient _category_ versus the `is_staple` _boolean_.
- Product naming — see §8.

---

## 5. Cocktail assumptions food will violate

These are the concrete places where "cocktail" is baked in. Each is tagged with
the phase that owns it.

1. **No domain column exists at all.** Every recipe read is implicitly
   all-cocktails. _(Phase 1)_
2. **Five cocktail-only columns live on `recipes`** — `method`, `glass`,
   `garnish`, `strength`, `base_spirit`. Food rows would be permanently null in
   all five, and `/recipes` selects them by name. _(Phase 5)_
3. **`match_recipes_detail` returns `method` and `glass` in its signature.**
   A food match card cannot use it as-is. _(Phase 3)_
4. **`ingredient_category` is a cocktail enum.** There is no way to file flour,
   chicken, or pasta without abusing `other`. _(Phase 6)_
5. **`unique (recipe_id, ingredient_id)`.** Food recipes routinely list one
   ingredient twice — "2 tbsp olive oil, divided", butter in the dough and
   butter for the pan, salt in two stages. `validateRecipe` currently _silently
   drops_ the second occurrence. This constraint is the single hardest blocker
   for realistic food ingestion. _(Phase 7)_
6. **No recipe sections.** Food recipes group lines under "For the sauce" /
   "For the topping"; `recipe_ingredients` has only `display_order`. _(Phase 7)_
7. **`unit` is free text.** Fine for `oz`/`dash`; food wants a controlled set
   plus a deliberate fallback. _(Phase 7)_
8. **`is_garnish` is a cocktail role.** The food analogue is "for serving".
   Also note the matcher keys off `is_optional`, not `is_garnish` — a garnish
   line that is not also optional counts as required. _(Phases 3, 7)_
9. **`popular_ingredients` and `related_recipes` hardcode
   `i.category <> 'garnish'`.** Both break the moment the taxonomy changes.
   _(Phase 6)_
10. **Staples are global and unconditional** — `water`, `ice`, `crushed ice`,
    `sugar`, `salt`. Food's natural staples (flour, pepper, neutral oil) would
    become assumed for cocktail matching too, since the flag has no domain.
    A cross-domain staple policy has to be decided explicitly. _(Phase 3/11.4)_
11. **Derivations assume zero effort.** Food's derivation space (garlic →
    minced garlic, bread → breadcrumbs, milk + acid → buttermilk) includes
    multi-input and effortful transformations the current one-way single-source
    edge cannot express, and that the matcher would wrongly treat as free.
    _(Phase 3, deliberately constrained)_
12. **Substitutions are bidirectional and unconditional.** Acceptable for
    cocktails; food substitutions are context-sensitive
    (stock ↔ stock is not universal). _(Phase 8/post-MVP)_
13. **`recipeYield: "1 cocktail"` is hardcoded** in the JSON-LD on the recipe
    detail page. _(Phase 13)_
14. **`/matches` is a client component that fetches all matches at once**, with
    no pagination. It works because the catalog is ~10–40 recipes. _(Phases 11, 16)_
15. **`/recipes` runs an unpaginated facet query over every published row** on
    each request to build filter options. _(Phases 10, 16)_
16. **`generateStaticParams` prerenders every recipe and every ingredient.**
    Build time scales linearly with the catalog. _(Phase 16)_
17. **The generation prompt is a single bartender prompt** with a
    cocktail-shaped JSON schema (glass, garnish, method, base spirit, ABV).
    _(Phase 8)_
18. **`source` is always the literal `'ai-generated'`.** No licensing or
    provenance model exists, which Phase 9 requires. _(Phases 8, 9)_
19. **The shopping list stores bare ingredient names in localStorage.** No ids,
    no recipe link, no domain, no account sync. _(Phase 12)_
20. **Copy is cocktail-only throughout** — "Build your bar", "my bar", "Your bar
    is empty", "In House Mixers", the martini-glass logo, the OG image, the
    manifest. _(Phases 4, 15)_
21. **No analytics events exist.** Vercel Analytics is page-level only, so
    §17's domain-tagged events are net-new. _(Phase 14)_

---

## 6. Baseline behavior (cocktail regression reference)

Recorded from the seeded fixtures so later phases can prove nothing moved.
All of these are asserted by the existing suite except where noted.

| Flow                 | Baseline                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog              | `/recipes` lists published recipes, 24/page, sorted by name; facets for method, glass, difficulty, base spirit, flavor tags                      |
| Match — derivation   | pantry `{orange}` → old-fashioned's `orange twist` is `have`, `derived_from = 'orange'`; `bourbon` stays `missing`                               |
| Match — substitution | pantry `{cachaça, lime, simple syrup}` → daiquiri `missing_count = 0`, `exact_count = 2`, `substitute_count = 1`                                 |
| Match — staples      | a recipe needing gin + sugar is fully covered by owning only gin                                                                                 |
| Match — zero overlap | pantry `{campari}` never returns daiquiri, even with `max_missing = null`; negroni returns with `missing_ingredients = ['gin','sweet vermouth']` |
| Match — default      | `max_missing` defaults to 2                                                                                                                      |
| Match — parity       | `match_recipes_detail` returns the same rows in the same order as `match_recipes`                                                                |
| Ingredient page      | `ingredient_detail` returns published recipes, both-direction substitutes with notes, one-way derivations                                        |
| Popular              | ranked by required-recipe count; staples and garnish-category ingredients excluded                                                               |
| Related              | ranked by shared non-staple non-garnish ingredients; `base_spirit` breaks ties                                                                   |
| Pantry               | anonymous localStorage; migrates into `pantry_items` on first sign-in, then clears localStorage                                                  |
| Favorites            | signed-in only; optimistic add/remove, refetch on error                                                                                          |
| Shopping list        | localStorage names; "add missing" from a match card                                                                                              |
| Detail page          | SSG with hourly revalidation; pantry status hydrates in a client island                                                                          |
| Build                | 17 routes, 2 SSG; succeeds with no Supabase env (empty `generateStaticParams`)                                                                   |

---

## 7. Files likely affected, by phase

| Phase                      | Files                                                                                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Add recipe domain      | new migration; `src/types/database.ts`; `scripts/pipeline/db.ts` (`ingestRecipe`); `scripts/pipeline/validate.ts` (`ResolvedRecipe`); `supabase/seed_test_recipes.sql`; `tests/matcher.test.ts:102`; `tests/popular-ingredients.test.ts:69`; new `tests/domain.test.ts`                  |
| 2 — Domain-aware queries   | `src/app/recipes/page.tsx`; `src/app/recipes/[slug]/page.tsx`; `src/app/favorites/page.tsx`; `src/app/sitemap.ts`; `src/components/recipe-card.tsx`; a new shared domain type in `src/lib/`                                                                                              |
| 3 — Generalize matching    | new migrations for `match_recipes`, `match_recipes_detail` (both need `drop function` — signature changes); `src/app/matches/page.tsx`; `src/components/almost-there-nudge.tsx`; `src/types/database.ts`; `tests/matcher.test.ts`                                                        |
| 4 — Bar/Kitchen structure  | `src/app/layout.tsx`; `src/components/site-header.tsx`; new `src/app/(bar)/…` and `src/app/kitchen/…`; `src/app/page.tsx`; `src/app/sitemap.ts`; redirects in `next.config.mjs`                                                                                                          |
| 5 — Metadata normalization | new migrations (detail tables); `src/types/database.ts`; `src/app/recipes/[slug]/page.tsx`; `src/app/recipes/page.tsx`; `src/components/recipes-filter.tsx`; `scripts/pipeline/db.ts`; `scripts/pipeline/validate.ts`                                                                    |
| 6 — Ingredient taxonomy    | migrations touching `ingredient_category` **and** `search_ingredients`, `ingredient_detail`, `popular_ingredients`, `related_recipes`; `src/data/cocktail-seed.ts`; `scripts/generate-seed-sql.ts`; `supabase/seed.sql`; `src/components/ingredient-browse.tsx`; `src/types/database.ts` |
| 7 — Food-ready ingredients | migration on `recipe_ingredients`; `src/components/recipe-pantry-status.tsx`; `src/app/recipes/[slug]/page.tsx`; `scripts/pipeline/validate.ts`; `src/lib/units/format.ts`                                                                                                               |
| 8 — Food ingestion adapter | `scripts/pipeline/` restructure into `core/` + `domains/{cocktail,food}/`; new food schema, prompts, validators; new pipeline tests                                                                                                                                                      |
| 9 — Seed food catalog      | new `src/data/food-seed.ts` or a curated source file; `supabase/` seed additions; dry-run reports                                                                                                                                                                                        |
| 10–14 — Kitchen UI         | `src/app/kitchen/**`; new food components; `src/components/recipe-card.tsx` composition; search and filters                                                                                                                                                                              |
| 15 — Rebrand               | `src/app/layout.tsx`; `src/app/page.tsx`; `src/components/{site-header,home-hero,empty-state,starter-suggestions,almost-there-nudge}.tsx`; `src/app/manifest.ts`; `src/app/opengraph-image.tsx`; `README.md`                                                                             |
| 16–17 — Review and rollout | all of the above; `docs/expansion-plan.md`; this file                                                                                                                                                                                                                                    |

---

## 8. Migration risks

1. **Function signature changes require `drop function`.** Postgres will not
   `create or replace` a function whose return type changes. Two migrations
   already do this correctly (`20260702120100`, `20260702120200`) — follow that
   precedent for `match_recipes`, `match_recipes_detail`, and any function whose
   return type includes `ingredient_category`.
2. **`ingredient_category` is referenced in three function return types**
   (`search_ingredients`, `ingredient_detail`, and implicitly by
   `popular_ingredients`/`related_recipes` predicates). Any change to the enum
   ripples through all of them plus `src/types/database.ts` and
   `ingredient-browse.tsx`'s `CATEGORY_ORDER`.
3. **`alter type … add value` cannot run in the same transaction that uses the
   new value** in older Postgres, and PGlite may differ from the Supabase
   server. If Phase 6 keeps an enum, split the value additions into their own
   migration file; if it moves to a lookup table, that concern disappears.
4. **`domain not null` with no default will break three existing insert paths
   immediately**: `supabase/seed_test_recipes.sql`, `tests/matcher.test.ts:102`,
   and `tests/popular-ingredients.test.ts:69`. All three must be updated in the
   same commit as the migration. This is intentional per plan §8.1 — a default
   would let food rows be silently classified as cocktails.
5. **`ingestRecipe` upserts on `slug`.** Once food exists, a food recipe whose
   name collides with a cocktail (e.g. "Sidecar") would silently overwrite it.
   Phase 8 needs either domain-scoped slugs or a domain-aware conflict target.
6. **Dropping the `recipe_ingredients` unique constraint** (Phase 7) changes
   `ingestRecipe`'s delete-then-insert semantics and removes the guard that
   `validateRecipe`'s de-duplication currently relies on. `match_recipes`
   already uses `select distinct`, so the matcher itself is safe.
7. **The staple set is global.** Adding a food staple changes cocktail matching
   results if any cocktail requires that ingredient. Test cocktail match
   snapshots after any staple change.
8. **`src/types/database.ts` is hand-authored.** There is no generator to run;
   every schema change needs a matching hand edit, and drift will only surface
   as a type error or, worse, as a silently wrong type. Keep the file's
   generated shape.
9. **`recipe_ingredients.ingredient_id` is `on delete restrict`.** Taxonomy
   cleanup in Phase 6 cannot delete an ingredient any recipe references.
10. **PGlite is not Supabase Postgres.** It runs the real migrations, which
    catches almost everything, but RLS enforcement, `auth.uid()`, and role
    grants are shimmed. RLS behavior must be verified against a real project
    before rollout (Phase 16/17).

---

## 9. Baseline tests to add

Ordered by the phase that needs them.

**Before Phase 1 (regression lock)**

- Snapshot `match_recipes` output for 3–4 representative pantries so any later
  ranking drift is visible. The current tests assert individual fields, not the
  full ordered result set.
- Assert `/recipes`-equivalent catalog query returns exactly the seeded
  published recipes.

**Phase 1**

- Every existing recipe backfills to `cocktail`.
- `food` and `cocktail` are accepted; an invalid value is rejected.
- A null domain is rejected after the migration.
- `ingestRecipe` sets `domain` explicitly.

**Phase 3**

- A food request never returns cocktails, and vice versa.
- A shared pantry ingredient satisfies a recipe in either domain.
- Two recipes with identical ingredient sets in different domains are separated
  by the domain filter only.
- Optional ingredients never increase `missing_count`.
- Existing cocktail assertions still pass unchanged.

**Phase 6**

- Every seeded ingredient keeps its id and slug across the taxonomy migration.
- Cocktail categories still group correctly in the browse UI.
- `popular_ingredients` and `related_recipes` still exclude garnishes.

**Phase 7**

- Fractional quantities, count units, "to taste" (null amount), divided
  ingredients, optional garnish, section ordering.
- Cocktail ingredient rendering is byte-identical to today.

**Phase 8**

- Food source parsing, validation failures, unresolved-ingredient reporting,
  dry-run output shape, idempotent re-runs, explicit domain assignment.

---

## 10. Open decisions

Two things could not be resolved by inspection and need a product answer before
the phases that depend on them.

**1. Product name.** The plan calls the product _RecipeAce_; the repository is
`recipeace-II`; the localStorage keys are `recipeace.*`; but every piece of
user-facing copy, the `<title>`, the manifest, the OG image and the logo say
**In House Mixers**. Phases 4 and 15 rewrite that copy, so the target name
needs deciding first. Nothing before Phase 4 depends on it.

**2. Cross-domain staple policy.** Staples are currently global, unconditional,
and invisible in the UI (§5.10). Plan §11.4 lists four options and recommends
"a small, explicit staple policy, made visible". Phase 3 has to pick one. The
narrowest change that satisfies the plan is to keep the existing global set,
add no food staples beyond `salt`/`sugar`/`water` (already present), and surface
the assumption in the Kitchen match UI in Phase 11.

---

## 11. Phase 0 completion check

| Criterion (plan §25)                                                 | Status                                  |
| -------------------------------------------------------------------- | --------------------------------------- |
| All core systems inspected                                           | yes — §3                                |
| Cocktail-specific assumptions explicitly identified                  | yes — §5, 21 items                      |
| No unresolved uncertainty about where domain filtering must be added | yes — §3.8 enumerates every entry point |
| Baseline application behavior documented                             | yes — §6, with all four checks green    |
| No new food routes / recipes / restructuring / migrations            | confirmed — this phase changed no code  |

---

## 12. Phase log

Running record of what each completed phase actually did. Later phases should
read this before assuming the inventory above is still accurate.

### Phase 0 — Baseline and inventory · complete

Inspection only. No code, schema, or data changed. Produced this document.

### Phase 1 — Add recipe domain safely · complete

`supabase/migrations/20260801120000_recipe_domain.sql` adds
`public.recipe_domain` (`'cocktail' | 'food'`) and a `recipes.domain` column,
following the plan's safe sequence: nullable column → backfill every existing
row as `cocktail` → assert nothing is unclassified (a `do` block that raises) →
`set not null` → index.

**No database default**, deliberately. A default would let a food recipe whose
write path forgot the column be silently filed as a cocktail (plan §8.1). The
constraint was verified directly against PGlite: an invalid enum value, an
explicit null, and an omitted column are all rejected; `food` is accepted; the
10 seeded recipes all backfilled to `cocktail`.

Write paths updated to state their domain explicitly:

- `scripts/pipeline/validate.ts` — `ResolvedRecipe` gains a required
  `domain: RecipeDomain`, and `validateRecipe` stamps `"cocktail"`. This is the
  cocktail adapter (plan §16.2); Phase 8's food adapter stamps `"food"`.
- `scripts/pipeline/db.ts` — `ingestRecipe` writes `domain`. This is the only
  recipe insert path in the application.
- `supabase/seed_test_recipes.sql`, `tests/matcher.test.ts`,
  `tests/popular-ingredients.test.ts` — fixtures updated.

`src/types/database.ts` (hand-authored) gains `recipe_domain` in `Enums` and
`domain` on the `recipes` Row/Insert/Update. It is **required, not optional, in
`Insert`** — that is what makes TypeScript refuse any future insert path that
omits it.

No application read path changed: every query selects explicit column lists, so
none of them picked up `domain` implicitly. Matching, ranking, and all cocktail
behavior in §6 are byte-identical.

`tests/recipe-domain.test.ts` adds 8 tests covering backfill, both valid values,
invalid values, explicit null, the missing default, coexistence of both domains
in one table, and the pipeline's explicit stamp.

Validation: lint, `tsc --noEmit`, `next build`, and `vitest run` (7 files,
43 tests) all pass.

**Correction (found in phase 2):** the phase-1 commit did _not_ actually update
`supabase/seed_test_recipes.sql`. With `domain` NOT NULL and no default, the
fixture insert failed, so every PGlite-backed suite failed to build its
database — all 6 DB test files errored. Fixed in `da5dd7f`; the 43-test
baseline is real from that commit onward.

### Phase 2 — Domain-aware recipe queries · complete

Two new modules under `src/lib/recipes/`:

- `domain.ts` — `RecipeDomain`, `DomainFilter` (`"cocktail" | "food" | "all"`),
  `parseDomainFilter`, and the Bar/Kitchen surface labels. One place where the
  application says "domain".
- `queries.ts` — every recipe read the app performs, each taking an **explicit**
  domain: `getRecipes` (paged + filtered catalog), `getRecipeFacets`,
  `getRecipesByIds` (favorites), `getPublishedRecipeSlugs` (sitemap,
  `generateStaticParams`), `getRecipeBySlug` (detail). `"all"` is spelled out
  rather than defaulted, so a new surface cannot forget to decide. Card columns
  live in one constant, and `RecipePreview` now carries `domain` (plan §10.3).

Call sites updated: `/recipes` (cocktail), `/recipes/[slug]` (all — one route
serves both domains), `/favorites` (all, ready for the phase-12 split),
`sitemap.ts` (all).

`supabase/migrations/20260801120100_domain_aware_recipe_queries.sql`:

- `ingredient_detail` gains an **optional** `p_domain` (drop + recreate: adding
  a parameter changes the function's identity). Null keeps today's
  both-domain behaviour, and every recipe object in the `recipes` jsonb now
  carries its own `domain` so a caller can group without a second round trip.
  The shared ingredient page stays cross-domain by design (plan §9.5); its copy
  no longer says "cocktails".
- `related_recipes` is scoped to the subject recipe's own domain. Sharing lime
  juice does not make a sorbet "more like" a daiquiri. Body-only change, so
  `create or replace` was enough.

Deliberately **not** changed: `match_recipes` / `match_recipes_detail`. Those
are phase 3, and their signatures change together.

Tests: `tests/recipe-queries.test.ts` (10 tests) drives the query layer through
a recording PostgREST stub and asserts the domain predicate is part of the
request — the thing that proves filtering is not happening in the browser.
`tests/domain-queries.test.ts` (7 tests) covers the SQL: single-domain listings,
all-domain listings, pagination inside a domain, the ingredient page in both
modes, and that "more like this" never crosses domains. `tests/db.ts` gains
`seedFoodFixture` — three food recipes built only from ingredients `seed.sql`
already has, one of which (`rum-lime-sorbet`) has the daiquiri's exact required
ingredient set so domain separation is the only thing under test.

Validation: lint, `tsc --noEmit`, `next build` (17 routes), `vitest run`
(9 files, 59 tests) all pass.

### Phase 3 — One matcher, two domains · complete

`supabase/migrations/20260801120200_match_recipes_domain.sql` drops and
recreates both matcher functions (return types and parameter lists change, so
`create or replace` is not available) with a third argument,
`p_domain public.recipe_domain default null`.

**No matching rule changed.** The ancestor walk, staple union, recursive
derivation expansion, one-hop bidirectional substitution reach, scoring and
ordering are carried over verbatim from `20260702120100`. The only new SQL is
`and (p_domain is null or r.domain = p_domain)` in the `required` CTE.

That claim was verified rather than asserted: `match_recipes(pantry, 2)` was
run over five representative pantries — `{gin, sweet vermouth}`,
`{white rum, lime juice, simple syrup}`, `{bourbon, lemon juice}`, `{campari}`,
`{cachaça, lime, simple syrup}` — against the schema with and without this
migration. Every row, count, missing-ingredient array and ordering is
identical. Three of those orderings are now frozen as `COCKTAIL_BASELINE` in
`tests/matcher.test.ts`, the ranking regression lock §9 asked for.

`match_recipes_detail` also changes its projection: `method` and `glass` are
replaced by `domain` and a `metadata` jsonb object, built per domain
(`{method, glass}` with nulls stripped for cocktails, `{}` for food until
phase 5 gives food something to show). This is invariant 14 — a food match card
is not handed five null drink fields — and it means the next domain's card
fields arrive without another signature change. `/matches` reads
`metadata.method` / `metadata.glass`; the rendered card is unchanged.

**Staple policy, decided and documented** (plan §11.4, open decision 2). The
staple set stays global, unconditional and tiny: `water`, `ice`, `crushed ice`,
`sugar`, `salt`. No food staples are added — flour, pepper and neutral oil are
deliberately *not* staples — because `is_staple` has no domain and adding one
would silently change cocktail results. The policy is written into the
migration header, exercised by a food-staple test, and Phase 11 surfaces it in
the Kitchen match UI. Per-user configuration stays post-MVP (§43.1).

Application call sites now name their domain: `/matches` and
`almost-there-nudge.tsx` both pass `p_domain: "cocktail"` — they are Bar
surfaces, and `/kitchen/matches` will pass `"food"` against the same function.

Index: `recipes_domain_idx` is replaced by `recipes_domain_published_idx
(domain, is_published)` — the pair the matcher and the catalog both filter on,
and a usable prefix index for domain-only lookups.

Tests: `tests/matcher.test.ts` grows from 7 to 13. New coverage — the cocktail
ranking baseline, food-never-returns-cocktails (using `rum-lime-sorbet`, whose
required ingredients are exactly the daiquiri's), one pantry ingredient
satisfying either domain through the same derivation, optional food
ingredients not raising `missing_count`, cross-domain staple behaviour, and
`match_recipes_detail` parity within a domain.

Validation: lint, `tsc --noEmit`, `next build` (17 routes), `vitest run`
(9 files, 65 tests) all pass.

### Phase 4 — Bar and Kitchen structure · complete

**Route convention** (now `DOMAIN_ROUTES` in `src/lib/recipes/domain.ts`, so
the mapping is declared once): each domain owns a subtree — `/bar`,
`/bar/recipes`, `/bar/matches`; `/kitchen`, `/kitchen/recipes`,
`/kitchen/matches` — and everything shared stays outside them: the pantry at
`/`, recipe details at `/recipes/[slug]`, `/favorites`, `/shopping`,
`/ingredients/[slug]`.

Moves (`git mv`, so history follows): `/recipes` → `/bar/recipes` (with its
loading skeleton), `/matches` → `/bar/matches`. Both old paths are **307**
redirects in `next.config.mjs` — temporary rather than permanent while the
expansion is in flight, and verified against a production build to preserve
the query string (`/matches?missing=1` → `/bar/matches?missing=1`).
`/recipes/[slug]` is untouched: one shared detail route, per §9.4.

New pages: `/bar` (overview — live cocktail count, entry points to matches and
the catalog, and a line saying the pantry is shared) and `/kitchen` (honest
placeholder — no food recipes exist yet, and it says so rather than linking to
routes that aren't built; §29's completion criteria explicitly ask for this).
`/bar/matches` is a client component, so its metadata lives in a sibling
`layout.tsx`.

`DomainSwitcher` (`src/components/domain-switcher.tsx`) sits in the header on
every viewport. Bar and Kitchen are two *places*, so it is a labelled `<nav>`
of links with `aria-current` on the active one — not a button group (§18). The
header's other links are secondary: `pantry` · `favorites` · `shopping`, with
the mobile overflow menu now carrying `pantry` too.

Copy: only the lines that described the product as drinks-only. Root metadata
description, the home `<h1>` ("Build your bar" → "Your pantry"), the first-run
hero (now the plan's "Add what you have. Discover what you can make."), the
matches empty state, the ingredient page's back link, the pantry badge
tooltip. The remaining "your bar" toasts and the `In House Mixers` brand
itself are phase 15's audit.

Internal links repointed: `recipes-filter`, `pantry-panel`,
`almost-there-nudge`, `/shopping`, `/favorites`, `sitemap.ts`, and the recipe
detail back-link — which now reads its own recipe's domain and returns to that
domain's catalog.

Validation: lint, `tsc --noEmit`, `next build` (19 routes), `vitest run`
(9 files, 65 tests) all pass; redirects checked against `next start`.

### Phase 5 — Shared recipe, domain-specific details · complete

**The field-by-field verdict** (§3.1's table, resolved):

| Field                                                                                            | Verdict          | Where it lives now                         |
| ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------ |
| id, slug, name, description, instructions, source, is_published, image_url, created_at, updated_at | shared           | `recipes`                                  |
| domain                                                                                           | shared           | `recipes` (the one place it is persisted)  |
| difficulty                                                                                       | **shared**       | `recipes` — easy/medium/advanced fits both |
| method, glass, garnish, strength, base_spirit, flavor_tags                                       | cocktail-only    | `cocktail_recipe_details`                  |
| prep/cook/total minutes, servings, course, cuisine                                               | food-only (new)  | `food_recipe_details`                      |

`20260802120000_recipe_detail_tables.sql` creates both detail tables (PK on
`recipe_id`, so at most one row per recipe; `on delete cascade`, so no orphans;
check constraints on strength, times and servings), enables RLS with the same
published-recipe rule `recipe_ingredients` uses, backfills every cocktail —
including all-null rows, so "a cocktail has exactly one details row" is a real
invariant — and asserts the backfill missed nothing.

Neither detail table has a `domain` column. §3 forbids it, so the pairing is
enforced by the writers and asserted by a test that joins each detail table
back to `recipes` and expects no mismatches. No cross-table trigger (§8.3).

The old cocktail columns on `recipes` are **kept, marked DEPRECATED in
`comment on column`, and no longer read or written**. Dropping them is phase
17's cleanup, per §23's additive-first rule.

**Catalog views.** A catalog page filters, sorts and paginates across shared
*and* domain fields in one query, which PostgREST cannot do across an embedded
resource (you cannot order parent rows by an embedded column). So
`cocktail_recipes` and `food_recipes` are `security_invoker` views that flatten
each detail table onto the shared fields. Storage stays normalised; the query
layer stays one implementation; RLS stays the base tables'.

**Query layer** (`src/lib/recipes/queries.ts`): `getRecipes({domain, …})` now
reads that domain's view, and `RecipePreview` carries `pills` — the domain's
short card metadata, already resolved — instead of `method`/`glass`.
`RecipeCard` takes `pills` and renders them; deciding what they are belongs to
the domain (§14.2's "prefer composition"). `getRecipeBySlug` returns a
discriminated union (`{domain: "cocktail", cocktail} | {domain: "food", food}`)
so the detail page cannot read the wrong domain's metadata by accident.
`getRecipesByIds` reads each domain's view and merges, keeping every row
domain-filtered in the database. Facets are domain-shaped by nature, so
`getRecipeFacets` became `getCocktailFacets`; the Kitchen gets its own in
phase 10.

One deliberate seam: `catalogQuery()` casts the builder to a small structural
type. The two views have different columns, so supabase-js infers a different
builder for each; without it the shared filter/sort/page logic would have to be
written out twice.

**Functions** (`20260802120100_functions_read_recipe_details.sql`, all
`create or replace` — no signature changes): `match_recipes_detail` builds its
`metadata` object from the detail tables and now fills the food branch
(`total_minutes`, `servings`, `course`); `related_recipes` reads `base_spirit`
and the card's method/glass from `cocktail_recipe_details`; `ingredient_detail`
returns a domain-shaped `metadata` object per recipe instead of bare
`method`/`glass`, since its list spans both domains.

**Pipeline**: `ResolvedRecipe` splits into shared fields plus a nested
`cocktail` object (difficulty stays shared); `ingestRecipe` upserts `recipes`
then `cocktail_recipe_details`; `updateRecipeMetadata` writes difficulty to
`recipes` and the drink fields to the detail table;
`loadRecipesMissingMetadata` is scoped to the cocktail domain (the enrichment
prompt is a bartender's); `loadRecipesMissingImages` reads the cocktail view.

Tests: `tests/recipe-details.test.ts` (9) covers the backfill count and
content, one-row-per-recipe, cascade delete, orphan rejection, the check
constraints, the cross-domain invariant, both views, and food metadata
arriving on a match card. `tests/recipe-queries.test.ts` grew to 12, including
"drink facets are never applied to a food query".

Validation: lint, `tsc --noEmit`, `next build` (19 routes), `vitest run`
(10 files, 77 tests) all pass.

### Phase 6 — Ingredient taxonomy · complete

**Decision: extend the enum, don't replace it.** The plan offers a lookup table
as an option (§8.6); an enum remains the simplest model that meets the actual
requirement. The taxonomy is a fixed product vocabulary rather than user data,
and no surface needs per-category metadata — the pantry browser already holds
the display order, and labels are the value with underscores replaced. Cost of
the choice, recorded so it can be revisited: adding a category needs a
migration. The moment a category has to carry data of its own — a shopping-list
aisle, an icon, a translated label — the lookup table becomes the right call.

`20260803120000_food_ingredient_categories.sql` adds 15 values: `meat`,
`seafood`, `egg`, `grain`, `pasta`, `bread`, `legume`, `canned_good`,
`oil_and_fat`, `herb`, `spice`, `condiment`, `sauce`, `baking`, `sweetener`.
The plan's other suggestions were already covered — Produce and Dairy exist,
Alcohol is the spirit/liqueur/wine/fortified_wine/bitters split, Beverages are
`mixer`/`juice`. Migration risk 3 is handled by the migration only *adding*
values; the first rows using them arrive with the phase 9 seed.

Taxonomy rules, now written into the migration header:

1. One catalog, no domain on ingredients — lime juice is one row.
2. `category` = what kind of thing this is (display and grouping only; the
   matcher never reads it).
3. `is_staple` = whether matching assumes you own it. **Independent** of
   category: flour is `baking` and is *not* a staple. This resolves §4's open
   item — the `staple` category and the `is_staple` boolean answer different
   questions, and the five existing rows keep both.
4. `parent_id` is the is-a hierarchy; categories are flat and play no part.
5. One category per ingredient until a surface needs more.

Risk 9 in §8 (`popular_ingredients` / `related_recipes` hardcode
`category <> 'garnish'`) turned out not to bite: extending rather than
replacing the enum keeps `garnish` a valid value, so both predicates still mean
what they meant. A test asserts it rather than leaving it to inspection.

Application: the `Category` union in `src/data/cocktail-seed.ts` (the seed's
source of truth) and the enum in `src/types/database.ts` gained the same 15
values; `CATEGORY_ORDER` in `ingredient-browse.tsx` now lists Bar shelves,
then Kitchen shelves, then shared, and category labels use `replaceAll` so
`oil_and_fat` renders as "oil and fat".

Tests: `tests/ingredient-taxonomy.test.ts` (6) — every food category exists,
the cocktail vocabulary is untouched, unknown categories are still rejected,
seeded ingredients kept id/slug/category, a new food ingredient lands in the
one shared catalog and is findable through `search_ingredients`, and garnishes
stay excluded from `popular_ingredients`.

Validation: lint, `tsc --noEmit`, `next build`, `vitest run` (11 files,
83 tests) all pass.

### Phase 7 — Food-ready ingredient lines · complete

`20260804120000_recipe_ingredients_food_ready.sql` does three things, each
forced by how food recipes are actually written:

1. **Drops `unique (recipe_id, ingredient_id)`** — §5's item 5, "the single
   hardest blocker". "2 tablespoons olive oil, divided", butter in the dough
   and butter for the pan, salt in two stages: all of those were impossible,
   and the cocktail validator silently dropped the second occurrence.
2. **Adds `section`** — the heading a line sits under. Null is the main list,
   which is every cocktail, so nothing about drinks moved.
3. **Adds `unique (recipe_id, display_order)`** — with `ingredient_id` no
   longer unique per recipe, the line's position is its natural key. That gives
   seeds and upserts a conflict target (both were updated) and makes ordering
   unambiguous.

Dropping the constraint means the two functions that *count* ingredients had to
stop counting a repeated one twice — both body-only changes:

- `match_recipes`'s `required` CTE groups by `(recipe_id, ingredient_id)` and
  keeps `min(display_order)`, so a recipe requires an ingredient once however
  many lines mention it, and `missing_ingredients` keeps its written order.
- `recipe_pantry_status` collapses repeated lines the same way, taking the
  first line's quantity and treating an ingredient as optional only when
  *every* line mentioning it is optional. The detail page renders its own
  lines and looks status up by ingredient id, so this is what keeps the
  "missing N ingredients" banner honest.

The cocktail ranking baseline in `tests/matcher.test.ts` still passes
unchanged, which is the proof that no drink moved.

**Units** (§32): `src/lib/units/vocabulary.ts` holds the controlled set —
volume (`tsp`, `tbsp`, `cup`, `oz`, `ml`, `l`, `dash`, `splash`, `drop`,
`barspoon`), weight (`g`, `kg`, `lb`), pieces (`each`, `pinch`, `clove`,
`slice`, `can`, `sprig`, `leaves`) — with `normalizeUnit` folding written
spellings ("Tablespoons" → `tbsp`, "large" → `each`) and `isKnownUnit` for
validators. The column stays `text`: an unanticipated unit ("handful") is
better recorded than dropped, which is the plan's "intentional fallback". One
wart, deliberately documented in the module: **`oz` means fluid ounce** here,
because that is what the bar has always meant and `format.ts` converts on that
basis — so food weights use `g`/`kg`/`lb`, never `oz`.

Rendering: `IngredientRow` carries `section`; the detail page selects it; the
pantry-status island groups lines by section in first-appearance order (an
unnamed group renders exactly as before) and keys rows by `display_order`
rather than `ingredient_id`, which repeated ingredients would have collided on.
The cocktail validator normalises units, sets `section: null`, and **keeps** its
de-duplication — a drink listing the same bottle twice is a model slip, not a
"divided" line. That is now adapter policy rather than a schema constraint.

Tests: `tests/recipe-ingredient-lines.test.ts` (9) — repeated lines, required
counted once, status reported once, optional lines, a "to taste" line with no
amount or unit, section grouping and order, the new position constraint,
cocktail lines byte-identical, and unit folding including the fallback.

Validation: lint, `tsc --noEmit`, `next build`, `vitest run` (12 files,
92 tests) all pass.

### Phase 8 — Food ingestion adapter · complete

**Structure.** The pipeline now has the core/domains split §16 asks for, with
the existing files moved rather than rewritten:

```
scripts/pipeline/
  run.ts, db.ts, enrich.ts, images.ts, image.ts   unchanged behaviour
  ingest-food.ts                                   food CLI
  core/  types.ts · slug.ts · report.ts
  domains/
    cocktail/  generate.ts · validate.ts          (git mv, history intact)
    food/      source.ts · validate.ts · ingest.ts
```

`core/types.ts` holds the shape every adapter produces: a `ResolvedRecipe`
discriminated on domain, carrying shared fields, its own domain's details,
`provenance` and `is_published`. The cocktail adapter stamps
`{source: "ai-generated"}` and `is_published: true` — exactly what `db.ts`
hardcoded before — so drinks ingestion is unchanged.

**Decision: the food adapter emits SQL rather than writing through the admin
client.** Food content is curated and reviewed (Decision 12), which makes it
reference data, and this repository already has a shape for reference data: a
typed source in `src/data` compiled to an idempotent SQL file
(`scripts/generate-seed-sql.ts` → `supabase/seed.sql`). Emitting SQL keeps the
entire path runnable and *testable* with no Supabase project — the tests apply
the generated file to PGlite and re-apply it to prove idempotence — and
idempotency comes from the same on-conflict clauses the existing seeds use.
`ingestRecipe` now refuses a non-cocktail recipe rather than silently writing
one badly.

**Input** (`domains/food/source.ts`): a `FoodCatalog` of the canonical
ingredients the recipes need, the aliases mapping real-world names onto them,
and the recipes — plain data, reviewable in a diff. `parseCatalog` fails a
malformed file at file level rather than a hundred times over.

**Validation** (`domains/food/validate.ts`, pure — §16.4): name, slug,
ordered instructions, source name *and* licence (§15 requires both), plausible
servings, non-negative times with `total` derived from prep + cook and rejected
if it is less than its parts, positive amounts, units folded to the vocabulary,
at least two required ingredients, and every ingredient resolving to the shared
taxonomy. Unresolved ingredients reject the recipe and are reported by name.
Warnings — off-vocabulary units, an amount with no unit, an ingredient the
instructions never mention — never block. Repeated ingredients are **kept**
(that is the whole point of phase 7); the drinks adapter still collapses them.

**Domain and publication**: every food recipe is stamped `domain: "food"` and
lands `is_published: false` unless the catalog explicitly says `publish: true`
(§34, invariant 16).

**Report** (`core/report.ts`, §16.5): proposed recipes with their normalized
lines, newly proposed canonical ingredients, alias mappings, unresolved
ingredients, duplicate candidates, warnings, rejections with reasons, and the
expected database operations. `isClean` gates the write — a run with anything
unresolved, duplicated or invalid writes nothing and exits non-zero.

**Duplicate detection** (§16.6, and §8 migration risk 5): slug collisions
within the batch and against supplied existing slugs, plus normalized-name
near-duplicates. The risk the inventory flagged — a food recipe silently
overwriting a cocktail through the `on conflict (slug)` upsert — is closed by a
guard the emitter puts *before* the transaction: it raises with the offending
slugs, so nothing is written. A test proves the seeded Daiquiri survives an
attempt to overwrite it.

CLI: `npm run pipeline:food -- --dry-run` (report only), `npm run pipeline:food`
(writes `supabase/seed_food.sql`), `--catalog x.json`, `--out path.sql`.

Schema: `20260805120000_recipe_source_provenance.sql` adds `source_url` and
`license` to `recipes` and documents what `source` means now.

Tests: `tests/food-pipeline.test.ts` (20) — acceptance and domain stamping,
opt-in publication, metadata carry-through, unit folding, sections, repeated
ingredients, unresolved reporting, catalog-introduced ingredients, seven
rejection cases, warnings, all three duplicate paths, report content,
malformed-catalog handling, generated SQL applied twice with an identical
snapshot, and the cross-domain slug guard.

Validation: lint, `tsc --noEmit`, `next build`, `vitest run` (13 files,
112 tests) all pass; `npm run pipeline:food -- --dry-run` runs clean against
the (still empty) catalog.

### Phase 9 — The first curated food catalog · complete

`src/data/food-seed.ts` — 13 recipes, 44 new canonical ingredients, 20 aliases
— compiled by `npm run pipeline:food` to `supabase/seed_food.sql` (43 KB,
idempotent, applied after `supabase/seed.sql`).

**Content and licence.** Every recipe is **original**: written for this app,
describing ordinary technique in its own words. Nothing is transcribed from a
cookbook or a website — §15's line is that ingredient lists carry little
protection but headnotes and instruction wording do. `source` and `license` are
both `"original"`, and the validator rejects a recipe that states neither.

**The 13**, chosen to cover §15.3's spread and to exercise the system rather
than to be large: soft scrambled eggs on toast · overnight oats · banana
pancakes · grilled cheese · cucumber tomato salad · lemon vinaigrette · garlic
butter spaghetti · spaghetti with tomato sauce · chicken fried rice · lentil
soup · sheet-pan chicken and potatoes · black bean tacos · chocolate chip
cookies. Nine are vegetarian; times run 5–60 minutes; difficulty spans easy and
medium.

They deliberately exercise: shared cocktail ingredients (lemon juice, lime
juice, fresh mint, fresh basil, milk, whole egg, sugar, salt, strawberry,
cucumber, hot sauce), repeated lines ("butter, divided" twice in one recipe),
sections ("For the sauce" / "To serve"), optional lines, weight *and* volume
*and* count units, and every food category the taxonomy gained in phase 6.

**"To taste" lines are optional.** Salt and pepper to taste is an adjustment,
not a requirement, and an unowned pinch of pepper must not hide a dinner
(§11.3). They still render — they are just not counted against a match.

**Four categories re-filed.** Now that the vocabulary exists, `whole egg` and
`egg white` moved from `dairy` to `egg`, and `fresh mint` / `fresh basil` from
`produce` to `herb`, in `src/data/cocktail-seed.ts`. Ids and slugs are
untouched (the seed upserts on name), and the taxonomy test asserts it.

**No substitutions or derivations**, deliberately. Food substitutions are
context-sensitive (§8.8) and this matcher treats them as universal and
bidirectional, so shipping none beats shipping wrong ones; food derivations are
mostly effortful transformations the matcher would wrongly treat as free
(§8.9). Both are post-MVP.

Tests: `tests/food-catalog.test.ts` (11) applies the *generated* SQL to a real
database — the shipped catalog still validates (so the SQL cannot go stale
unnoticed), every recipe has a detail row and provenance, no dangling
ingredient references, shared ingredients are shared rather than duplicated,
aliases resolve, a stocked kitchen pantry produces real matches, optional lines
never block one, one pantry answers both domains, sections and repeated lines
survive the round trip, and **the Bar's rankings are unchanged**.
`tests/db.ts` gains `seedFoodCatalog` — loaded only by suites that are about
food, so the cocktail suites keep asserting against their small fixture set.

Validation: lint, `tsc --noEmit`, `next build`, `vitest run` (14 files,
123 tests) all pass; `npm run pipeline:food -- --dry-run` reports 13 accepted,
0 rejected, nothing unresolved.

**Next up: Phase 10** — build Kitchen recipe browsing.
