# In House Mixers — Polish Plan 2

## Context

`docs/build-plan.md` (5 sessions) and `docs/polish-plan.md` (5 phases) are complete
and in `main`. The app is well-architected — RSC/client-island split, a consistent
`useSyncExternalStore` state pattern, SSG + SEO on recipe pages, favorites, shopping
list, tests, CI. This plan closes the remaining gap: **visual identity and feature
depth**. It turns a functional MVP into something that looks designed and reads as a
serious cocktail resource.

20 items, 9 phases. Run in numeric order, one phase per Claude Code session, fresh in
the repo root. `AGENTS.md`/`CLAUDE.md` discipline (simplicity-first, surgical changes,
goal-driven) applies throughout. To execute: "Phases 1–N are complete; execute Phase
N+1."

## Dependency order

P1 Design foundation ........ tokens + palette + font (EVERYTHING inherits this)
├─ P2 Brand shell .......... toggle, assets, header (icons → P9)
├─ P3 Card & home .......... RecipeCard, hero, nudge (RecipeCard → P5, P7, P8)
├─ P4 States & feedback .... toasts, empty, skeletons
├─ P5 Recipe metadata ...... columns + pipeline + facets (needs P3 card for pills)
├─ P6 Scaler & units ....... serving scaler, oz⇄ml
├─ P7 Detail enrich ........ related, source, JSON-LD (needs P3 card)
├─ P8 Ingredient pages ..... new SEO surface (needs P3 card)
└─ P9 Production hardening .. copy, PWA, analytics (needs P2 icons)

Every phase depends on **P1**. P3 must precede P5/P7/P8 (they reuse `RecipeCard`).
P2 must precede P9 (maskable icons/manifest). Otherwise phases are independent; run
in order for safety.

## Item → phase map (all 20 placed)

| Phase | Items        | Theme                            |
| ----- | ------------ | -------------------------------- |
| P1    | 1            | Design token foundation          |
| P2    | 2 · 5 · 12   | Brand shell (chrome + identity)  |
| P3    | 3 · 4 · 9    | Card component & home surface    |
| P4    | 13 · 14 · 15 | States & feedback                |
| P5    | 6            | Recipe metadata & catalog facets |
| P6    | 7 · 8        | Serving scaler & unit conversion |
| P7    | 10 · 16 · 18 | Recipe-detail enrichment & SEO   |
| P8    | 11           | Per-ingredient pages             |
| P9    | 17 · 19 · 20 | Production hardening             |

## Global cross-cutting decisions (decided once, don't re-litigate)

- **Committed palette.** Brand accent is **copper/amber**; neutrals are **warm stone**,
  not pure gray/black. Status colors (green=have, amber=substitute, red=missing) are
  semantic and stay as-is. Exact values, set in P1:

  Light:
  --background #fafaf9
  --surface #ffffff
  --foreground #1c1917
  --muted #78716c
  --border #e7e5e4
  --accent #b45309
  --accent-foreground #ffffff

  Dark:
  --background #0c0a09
  --surface #171412
  --foreground #fafaf9
  --muted #a8a29e
  --border #2a2522
  --accent #f59e0b
  --accent-foreground #1c1917
  - **Token access.** Expose every token as a Tailwind v4 theme utility via `@theme inline`
    (`--color-surface: var(--surface)`, etc.) so `bg-surface`, `text-muted`, `border-border`,
    `text-accent`, `bg-accent` work. Prefer these over raw `black/10`-style opacity going
    forward. Incidental hover tints (`hover:bg-black/[0.04]`) may remain — do not chase
    every one.

- **No new runtime dependencies** except where a phase explicitly calls for them (P9
  analytics/monitoring, which can't be hand-rolled). Theme toggle, toasts, and the
  service worker are all built dep-free. OG image uses built-in `next/og`.
- **New client stores follow the existing pattern** — the unit-preference store (P6)
  mirrors the pantry/shopping stores: module-level snapshot, `useSyncExternalStore`,
  stable server snapshot, localStorage persistence, a `*Ready()` hydration gate.
- **Public store hook signatures are frozen.** `usePantry`, `useUser`, `usePantryReady`,
  `useFavorites`, `useShopping`, and mutators keep their shapes.
- **New surfaces introduced:** design tokens in `globals.css` (P1); `ThemeToggle` +
  no-flash inline script (P2); redesigned `icon.svg`/`apple-icon` + `opengraph-image`
  (P2); `components/toast/*` (P4); new `recipes` columns + `scripts/pipeline/enrich.ts`
  (P5); `lib/units/store.ts` + serving-scaler control (P6); `related_recipes` RPC (P7);
  `/ingredients/[slug]` + ingredient `slug` column + `ingredient_detail` RPC (P8);
  `public/sw.js` + registration (P9).

---

## Phase 1 — Design token foundation

**Item:** 1 · **Workload:** Medium–Large (solo)

### Why first

Every visual phase reads these tokens. Landing the system once, against a codebase
that currently hardcodes black/white opacity, makes P2–P8 a matter of applying tokens
rather than inventing color per component. There is also a live bug to fix here:
`globals.css` sets `body { font-family: Arial }`, so the Geist font loaded in
`layout.tsx` never actually renders.

### Tasks

1. Rewrite `src/app/globals.css`:
   - Define the committed light palette on `:root` and the dark palette on **both**
     `@media (prefers-color-scheme: dark)` (the system default) **and** a `.dark` class
     selector (the explicit override P2 will toggle). Light stays under `:root`; add a
     `.light` class that re-asserts light values so an explicit light choice wins over
     the media query.
   - Extend `@theme inline` with `--color-surface`, `--color-muted`, `--color-border`,
     `--color-accent`, `--color-accent-foreground` mapped to the vars above.
   - Remove the `font-family: Arial…` line; set `body { font-family: var(--font-sans),
system-ui, sans-serif; }` so Geist applies. Add a subtle default `color-scheme`.
2. Migrate the shared visual primitives to tokens (do **not** rewrite every file's hover
   opacity — migrate the structural colors):
   - Borders: `border-black/10 dark:border-white/15` → `border-border`.
   - Secondary text: `opacity-60`/`opacity-70` used for muted copy → `text-muted`.
   - The primary button in `pantry-panel.tsx`/`auth-form.tsx` (`bg-foreground
text-background`) → introduce a reusable accent treatment (`bg-accent
text-accent-foreground`); apply to primary CTAs only.
   - The header count badge and pantry CTA get the accent.
3. Verify nothing regressed visually in both schemes across `/`, `/recipes`, a recipe
   detail, `/matches`, `/login`.

### Acceptance criteria

- Geist renders on `body` (inspect computed font-family — not Arial).
- `bg-surface`/`text-muted`/`border-border`/`text-accent`/`bg-accent` are usable
  utilities and appear in the app.
- Dark palette applies via system preference **and** via a manually-added `.dark` class
  on `<html>` (test by hand-adding the class); `.light` forces light.
- `npm run lint` and `npm run build` pass.

### Cautious decisions

- **Scope guard:** establish the system and convert structural colors + primary CTAs.
  Leave incidental hover/opacity tints. A follow-up can finish the long tail; do not
  balloon this into a 20-file rewrite.
- Keep pure `#ffffff` for `--surface` in light so cards read as raised against the warm
  `#fafaf9` background.

---

## Phase 2 — Brand shell (chrome + identity)

**Items:** 2 (theme toggle) · 5 (wordmark, favicon, OG) · 12 (header) · **Workload:** Medium–Large

### Why grouped

All three are the global chrome and depend only on P1 tokens. The header is where the
wordmark, the theme toggle, active-nav state, and the mobile treatment all land, so
building them together avoids touching `site-header.tsx` three times.

### Tasks

1. **Theme toggle (2).** Add a no-flash inline script in `layout.tsx` `<head>` that,
   before paint, reads a `theme` cookie (`light`|`dark`|`system`) and sets the matching
   `light`/`dark` class on `<html>` (resolving `system` via `matchMedia`). Add a small
   client `ThemeToggle` (3-state or cycle) that writes the cookie and updates the class
   live; place it in the header. No dependency, no hydration flash.
2. **Brand assets (5).** Redesign `src/app/icon.svg` and `src/app/apple-icon.png` as a
   simple copper cocktail-glass mark on the new palette. Add
   `src/app/opengraph-image.tsx` using `next/og` `ImageResponse` — a branded default OG
   (wordmark + tagline) for routes without a recipe image. Confirm recipe detail still
   overrides with its own image.
3. **Header (12).** Rebuild `site-header.tsx`:
   - A proper wordmark (mark + "In House Mixers"), not the bare emoji string.
   - Active-route styling on nav links (`usePathname`), accent underline or weight.
   - The pantry-count becomes an accent pill.
   - Mobile: collapse secondary items (favorites, shopping, email, logout) behind a
     menu button under `sm`; keep bar/recipes/matches + count visible. The nav currently
     can carry up to eight items and crowds a 380px screen.

### Acceptance criteria

- Toggling theme switches palette instantly with no flash on reload; the choice persists
  across reloads and navigation; `system` follows the OS.
- Favicon and apple icon show the new mark; a shared link without a recipe image renders
  the branded OG image.
- Header shows an active state for the current route and does not overflow on a 380px
  viewport (secondary items behind a menu).
- Lint + build pass.

### Cautious decisions

- Keep the toggle dep-free (cookie + class), not `next-themes`.
- OG image is static-brand + per-recipe override only; do not build dynamic per-recipe
  OG composition here.

---

## Phase 3 — Card component & home surface

**Items:** 3 (card redesign) · 4 (home hero) · 9 (almost-there nudge) · **Workload:** Medium

### Why grouped

The `RecipeCard` and the home page are the two most-seen surfaces. Redesigning the card
now means P5/P7/P8 inherit the final card. The hero and the "almost there" nudge are both
home-page additions keyed off pantry state, so they share `page.tsx`.

### Tasks

1. **RecipeCard (3).** Rework `src/components/recipe-card.tsx`:
   - Fixed `aspect-[3/2]` image with a subtle bottom gradient scrim.
   - Move `FavoriteHeart` to an overlay button, top-right of the image.
   - `method`/`glass` as small pills (`bg-surface`/`border-border`), not uppercase gray.
   - Hover: border-accent + slight lift (`transition`, `hover:-translate-y-0.5`).
   - **Branded fallback** for `image_url == null`: an accent-tinted tile showing a
     glass-type glyph or the recipe monogram, same aspect ratio, so grids stay even.
   - Preserve the `badge`/`children`/`titleAs` slot API the matches page depends on.
2. **Home hero (4).** In `src/app/page.tsx`, add a compact hero above the search:
   headline, one-line value prop, a 3-step "add what you own → see matches → shop the
   gap." Render it **only when the pantry is empty** (gate on `usePantryReady` +
   `usePantry().length`), so returning users skip it. Delete the commented-out dead
   block currently in this file.
3. **Almost-there nudge (9).** A client strip under `PantryPanel`, shown when the bar is
   non-empty: call `match_recipes_detail` with `max_missing: 1`, count recipes with
   `missing_count === 1`, and render "You're one bottle away from **N** cocktails →"
   linking to `/matches?missing=1`. Reuse the existing keyed-outcome fetch pattern.
   Render nothing when N is 0 or on error.

### Acceptance criteria

- All three consumers (`/recipes`, `/favorites`, `/matches`) render the redesigned card
  with no functional regression; image-less recipes show the branded fallback.
- Empty bar shows the hero; a non-empty bar hides it and shows the nudge (when N ≥ 1).
- No dead/commented code remains in `page.tsx`.
- Lint + build pass.

### Cautious decisions

- The favorite overlay must not trigger card navigation (`preventDefault`/`stopPropagation`,
  as `AddMissingButton` already does).
- The nudge reuses `match_recipes_detail`; do not add a new RPC.

---

## Phase 4 — States & feedback

**Items:** 13 (toasts) · 14 (empty states) · 15 (skeletons) · **Workload:** Medium

### Why grouped

One coherent UX-feedback family: confirm actions (toasts), dignify emptiness (empty
states), and remove layout shift while loading (skeletons). All shallow, all depend only
on P1.

### Tasks

1. **Toasts (13).** Add `src/components/toast/` — a dep-free provider (context + portal +
   auto-dismiss) mounted in `layout.tsx`, and a `toast(message)` helper. Fire on
   pantry add/remove, shopping add/remove, favorite toggle ("Added bourbon", "On your
   shopping list"). Keep them brief and bottom-anchored; respect `prefers-reduced-motion`.
2. **Empty states (14).** Replace the plain gray sentences on empty bar (`PantryPanel`),
   empty `/favorites`, empty `/shopping`, and `recipes/[slug]/not-found.tsx` with a small
   inline SVG/glyph + a sharper CTA. Consistent component (`EmptyState` with icon/title/
   action).
3. **Skeletons (15).** Replace text fallbacks ("Mixing…", "Loading…") on `/matches`,
   `/favorites`, and `PantryPanel` with skeleton cards/rows matching final layout — extend
   the pattern already in `src/app/recipes/loading.tsx`. Search results panel keeps its
   inline "Searching…" (it's fine).

### Acceptance criteria

- Adding/removing a pantry item, shopping item, or favorite fires a visible toast that
  auto-dismisses; no dependency added.
- The four empty states render a branded illustration + CTA.
- `/matches` and `/favorites` show skeletons (not text) during their client fetch, with
  no layout shift when data lands.
- Lint + build pass.

### Cautious decisions

- Toasts are ephemeral UI only — no store, no persistence.
- Keep one shared `EmptyState` and one shared skeleton primitive; don't hand-roll each.

---

## Phase 5 — Recipe metadata & catalog facets

**Item:** 6 · **Workload:** Large (splittable: 5a data/pipeline, 5b UI/facets)

### Why here

The highest feature-depth return, and its UI (pills on cards) needs the P3 card. It's the
heaviest phase — split it if a single session is too large.

### Prerequisites

P3 (RecipeCard). Local Supabase for migration + backfill ideally.

### Tasks — 5a (data + pipeline)

1. **Migration** (new file, do not edit existing): add to `public.recipes` —
   `strength smallint` (estimated ABV %, nullable), `difficulty` (new enum
   `easy|medium|advanced`, nullable), `flavor_tags text[] not null default '{}'`,
   `base_spirit text` (nullable). Index `flavor_tags` (GIN) and `base_spirit`.
2. **Controlled tag vocabulary:** enforce `flavor_tags ∈ {citrusy, boozy, refreshing,
creamy, bitter, sweet, sour, herbal, spicy, fruity, smoky}` in `scripts/pipeline/
validate.ts` (drop unknown tags).
3. **Pipeline:** extend the emit schema in `scripts/pipeline/generate.ts`, the Zod schema
   in `validate.ts`, and the insert in `scripts/pipeline/db.ts` to populate the four
   fields. Regenerate `src/types/database.ts`.
4. **Backfill:** new `scripts/pipeline/enrich.ts` (idempotent, mirrors `images.ts`): find
   published recipes missing metadata, ask the LLM for just those four fields per recipe
   (given name + ingredients), update in place. Add an `npm run pipeline:enrich` script.

### Tasks — 5b (UI + facets)

5. **Pills:** render `difficulty`, `strength` ("~24% ABV"), and `flavor_tags` as pills on
   `RecipeCard` and the recipe detail header. Add the new fields to the card/detail select
   lists.
6. **Catalog facets:** extend `recipes-filter.tsx` and the `recipes/page.tsx` query with
   `difficulty` (select), `base_spirit` (select), and `flavor_tags` (multi via repeated
   `tag` params, `.contains`). Add a "strength" sort option. Keep `is_published = true`;
   preserve existing `q`/method/glass/sort/pagination. Facet option lists come from the
   whole published catalog (as method/glass already do).

### Acceptance criteria

- Migration applies; `enrich` backfills existing recipes idempotently (re-running is a
  no-op); types regenerate and both RPC callers still typecheck.
- Cards and detail show difficulty/strength/tag pills.
- `/recipes` filters by difficulty, base spirit, and one-or-more flavor tags, sorts by
  strength, all reflected in the URL and composable with existing controls; `count`
  respects active facets.
- Lint + build pass.

### Cautious decisions

- `strength` is an **estimate**; label it as approximate ("~24%"), never precise.
- Constrain tags to the fixed vocabulary so faceting stays sane — do not let the LLM
  invent tags.
- If one session is too large, land 5a as its own PR, re-seed/backfill, then 5b.

---

## Phase 6 — Serving scaler & unit conversion

**Items:** 7 (serving scaler) · 8 (oz⇄ml toggle) · **Workload:** Medium

### Why grouped

Both are about how quantities are displayed and pair naturally on the recipe detail page.

### Prerequisites

P1.

### Tasks

1. **Unit store (8).** `src/lib/units/store.ts` following the pantry-store pattern:
   `useUnit()` → `'oz' | 'ml'`, `setUnit`, `useUnitReady()`, persisted in localStorage
   (`recipeace.unit.v1`). A small toggle in the header (or beside the ingredient list).
2. **Conversion.** A pure helper: convert only when `unit ∈ {oz, ounce, fl oz}`
   (1 oz = 29.5735 ml, round ml to nearest 5; oz shown as fractions — ½, ¼, 1½). Leave
   dash/barspoon/tsp/tbsp/each untouched. Apply in `recipe-pantry-status.tsx` ingredient
   rows and the `/matches` card ingredient chips (both render amounts).
3. **Serving scaler (7).** On the recipe detail page, a 1× / 2× / 4× / custom stepper
   (client state) that multiplies every numeric `amount` live. Format scaled oz as
   fractions, ml as integers. Detail page only.

### Acceptance criteria

- Toggling oz/ml converts volumetric amounts on detail and matches; non-volumetric units
  are unchanged; the choice persists across reloads.
- The scaler multiplies all quantities on the detail page and composes with the unit
  toggle (2× in ml shows doubled ml).
- Lint + build pass.

### Cautious decisions

- Scaler is detail-only; do not scale matches cards (noise).
- Never convert `dash`/`barspoon`/`each`; only oz↔ml.

---

## Phase 7 — Recipe-detail enrichment & structured data

**Items:** 10 (related recipes) · 16 (source + garnish dedupe) · 18 (JSON-LD) · **Workload:** Medium

### Why grouped

All three enrich the recipe detail page and its SEO. Related recipes reuses the P3 card.

### Prerequisites

P3 (RecipeCard). Local Supabase for the new RPC.

### Tasks

1. **Related recipes (10).** New migration + `related_recipes(p_recipe_id, limit)` RPC
   ranking other published recipes by **shared non-staple ingredient count** (exclude
   staples/garnish; if `base_spirit` from P5 exists, add it as a tiebreak booster, but do
   not require P5). Add a "More like this" row on the detail page using `RecipeCard`.
   Regenerate types.
2. **Source + garnish (16).** Display `recipes.source` as a small "Source: …" line on
   detail (currently stored, never shown). Select `is_garnish` in the detail
   ingredient query and **split garnish rows out of the main ingredient list** (or mark
   them), so a garnish no longer appears both in the list and in the free-text `garnish`
   field.
3. **JSON-LD (18).** Emit schema.org `Recipe` structured data on the detail page (name,
   image, `recipeIngredient` from the ingredient rows, `recipeInstructions` from
   `instructions`, `recipeYield`). Server-rendered `<script type="application/ld+json">`.

### Acceptance criteria

- Detail pages show a "More like this" row of relevant recipes (shared-ingredient ranked).
- `source` renders when present; garnish ingredients are no longer duplicated between the
  list and the garnish field.
- Each detail page emits valid `Recipe` JSON-LD (validate against a structured-data
  linter).
- Lint + build pass.

### Cautious decisions

- `related_recipes` ranks on shared ingredients so it runs **independent of P5**; treat
  `base_spirit` as an optional booster only.
- JSON-LD must reflect the server-rendered ingredient rows, not the client pantry-status
  overlay.

---

## Phase 8 — Per-ingredient pages

**Item:** 11 · **Workload:** Medium–Large (solo)

### Why solo

A whole new indexable route with its own RPC, static params, metadata, and internal
linking — a large SEO surface. Coherent enough to own a session; reuses the P3 card.

### Prerequisites

P3 (RecipeCard). Local Supabase.

### Tasks

1. **Slug (migration).** Add `slug text unique` to `public.ingredients`, backfilled by
   slugifying `name`. Update `scripts/generate-seed-sql.ts` to emit slugs and regenerate
   `supabase/seed.sql`; add a data migration for existing rows. Index it. Regenerate types.
2. **RPC.** `ingredient_detail(p_slug)` (or a small set of queries) returning: the
   ingredient (name/category/is_staple), recipes that use it (id/slug/name/method/glass/
   image_url, published only), its substitutes (both directions of
   `ingredient_substitutions`), and what it derives (`ingredient_derivations`).
3. **Route.** `src/app/ingredients/[slug]/page.tsx` — server-rendered with
   `generateStaticParams` (all ingredient slugs), `generateMetadata` (title/description/
   canonical), `revalidate = 3600`. Sections: what it is, "Used in N recipes" (a
   `RecipeCard` grid), substitutes, derivations. Add `loading.tsx` and `not-found.tsx`.
4. **Linking + sitemap.** Link ingredient names to their pages from recipe detail
   (`recipe-pantry-status.tsx`) and the ingredient browser (`ingredient-browse.tsx`). Add
   ingredient URLs to `src/app/sitemap.ts`.

### Acceptance criteria

- `/ingredients/<slug>` is statically generated for every ingredient, shows its recipes,
  substitutes, and derivations, and 404s cleanly for unknown slugs.
- Ingredient names on recipe detail and the browser link to these pages.
- `/sitemap.xml` includes ingredient URLs.
- Lint + build pass.

### Cautious decisions

- Staple ingredients get a page but flag them "always on hand"; keep it simple.
- Reuse `RecipeCard`; do not build a second card.

---

## Phase 9 — Production hardening

**Items:** 17 (copy cleanup) · 19 (PWA + manifest) · 20 (analytics + monitoring) · **Workload:** Medium

### Why last

Final pass. PWA needs the P2 icons; analytics/monitoring want the full feature set in
place to be worth measuring.

### Prerequisites

P2 (icons). This phase **deliberately introduces dependencies** (analytics/monitoring
can't be hand-rolled) — flagged below for veto.

### Tasks

1. **Copy cleanup (17).** Fix `auth-message.tsx` (mangled JSX indentation + off-brand
   voice — "InHome", "Yay!"), tighten the `/login` blurb, unify microcopy voice across
   pages, and remove any remaining dead/commented code. Cosmetic, cross-cutting, low-risk.
2. **PWA (19).** Hand-rolled `public/sw.js` (no dep): precache the app shell, runtime
   stale-while-revalidate for recipe detail pages; register it from a small client
   component in `layout.tsx`. Fix `manifest.ts`: set `theme_color`/`background_color` to
   the palette (`#fafaf9`), and add maskable icon variants (`purpose: "maskable"`) from
   the P2 assets. Note in a comment that a manifest can't express the dark palette.
3. **Analytics + monitoring (20).** Add `@vercel/analytics` `<Analytics/>` in `layout.tsx`
   and `@sentry/nextjs` with minimal config (client + server + edge). Wrap the existing
   `error.tsx` reset boundary to report. Document required env vars in the README.

### Acceptance criteria

- No dead code or off-voice copy remains; voice is consistent across pages.
- The app is installable (valid manifest + SW + maskable icons) and recipe pages load
  from cache offline after a first visit.
- Page views and errors report to the respective services; env vars are documented.
- Lint + build pass.

### Cautious decisions

- **New deps are limited to this phase** and to analytics/monitoring only — veto here if
  unwanted; the PWA and copy work are dep-free and can ship without them.
- Keep the service worker minimal (shell + recipe pages); do not attempt full offline of
  auth'd/pantry-dependent surfaces.

---

## Execution notes

- Run **1 → 9** in order. P1 is a hard prerequisite for all; P3 precedes P5/P7/P8; P2
  precedes P9.
- **Heaviest:** P5 (has an explicit 5a/5b split), then P2 and P8.
- **Local Supabase** is needed for the migrations/RPCs/backfill in P5, P7, P8; the
  env-less CI build path already degrades gracefully (`generateStaticParams` returns `[]`).
- After P5's migration, apply migrations and run `pipeline:enrich` before P7 (so
  `base_spirit` is available as the related-recipes booster).
