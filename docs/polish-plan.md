# In House Mixers II — Polish Plan

## Context

All five build sessions are complete and verified: `npm run build`, `npm run lint`,
and TypeScript all pass clean; every route, store, and the full auth flow are in
place. This plan takes the two follow-up lists — **List A (additions)** and
**List B (improvements/optimizations)** — and merges them into five phases.

- **List A:** A1 sitemap/robots · A2 add-missing shopping list · A3 catalog
  sort/filter · A4 surprise-me · A5 share/copy · A6 empty-bar starter suggestions
- **List B:** B1 SSG recipe pages · B2 strict mode · B3 metadataBase ·
  B4 unify auth listeners · B5 collapse two-query fetch · B6 extract RecipeCard ·
  B7 tests + CI floor

## How this plan is organized

Two rules governed the split:

1. **Continuity beats balance.** No single feature is split across phases. A
   phase is a coherent surface (recipe SEO, the catalog, the matches loop,
   client state), so a Claude Code session never has to half-build something.
2. **Pair A with B by shared surface, not by force.** Each List A addition is
   paired with the List B item(s) that touch the same files or unblock it. Two
   List B items (strict mode, CI) are cross-cutting hygiene with no natural
   feature partner — they are deliberately isolated as the foundation phase
   rather than bolted onto an unrelated feature. Forcing a pairing there would
   violate rule 1.

**Dependency order (must run in sequence):**

```
Phase 1  Foundation ......... strict + CI floor      (everything inherits this)
   ↓
Phase 2  Discoverability .... SSG + SEO + sharing     (recipe route + metadata)
   ↓
Phase 3  Catalog ............ RecipeCard + filters    (extract card, then reuse)
   ↓
Phase 4  Matches loop ....... fetch opt + shopping    (heaviest; splittable)
   ↓
Phase 5  Client state ....... unify auth + home       (store refactor + cold-start)
```

Phases 2–5 only depend on Phase 1 (strict + CI) and on the phase before them for
the shared component/state they build on. Within a phase, tasks are ordered so
the optimization (B) lands before the feature (A) that consumes it.

## Item → Phase map (all 13 items placed)

| Phase | List A | List B | Theme                             |
| ----- | ------ | ------ | --------------------------------- |
| 1     | —      | B2, B7 | Engineering foundation            |
| 2     | A1, A5 | B3, B1 | Static rendering, SEO & sharing   |
| 3     | A3     | B6     | Catalog browse & shared card      |
| 4     | A2, A4 | B5     | Matches loop & fetch optimization |
| 5     | A6     | B4     | Client state & home cold-start    |

## Global prerequisites & cross-cutting decisions

These are decided once here so no phase re-litigates them.

- **`NEXT_PUBLIC_SITE_URL`** — a new env var (e.g. `https://recipeace.app`) is
  introduced in Phase 2 and used by `metadataBase`, canonical URLs, `sitemap.ts`,
  and `robots.ts`. Add it to `.env.local`, the deploy environment, and the README.
- **`is_published` filtering** — the catalog, matches, sitemap, and SSG param
  generation should all filter `is_published = true`. The current pages don't
  consistently do this; each phase that touches those queries adds the filter.
  _(Cautious call: if the intended behavior is "all seeded recipes are live," this
  is a no-op — but filtering is the safe default and costs nothing.)_
- **Shopping list stores names, not IDs** — `match_recipes` returns
  `missing_ingredients` as canonical name strings, not ingredient IDs. Rather than
  change the RPC signature, the Phase 4 shopping list is keyed by ingredient
  **name** (a shopping list is a list of names anyway). Both surfaces supply
  canonical names: matches via `missing_ingredients`, the detail page via the
  `name` field on each `recipe_pantry_status` row. This avoids a schema/RPC change.
- **New client stores follow the existing `useSyncExternalStore` pattern** — the
  shopping store (Phase 4) and unified auth store (Phase 5) mirror the current
  pantry/favorites stores: module-level snapshot, optimistic writes, stable
  server snapshot for hydration.
- **Public store hooks are frozen** — `usePantry`, `useUser`, `usePantryReady`,
  `useFavorites`, `useFavoritesReady`, and the mutators keep their signatures.
  The Phase 5 auth unification is an internal refactor only; no consumer changes.

---

## Phase 1 — Engineering Foundation

**Items:** B2 (strict mode) · B7 (tests + CI floor)
**Workload:** Medium–Large · **List A / B balance:** foundation phase, B-only by design

### Why paired / why first

Both are the project's quality floor and share no surface with any feature, so
pairing either with a List A addition would either dilute the foundation or
fracture that feature's continuity. They go first for a hard reason:
**every later phase should be written and merged under strict TypeScript and
behind a green CI gate.** Enabling strict after feature work means more accumulated
fallout to fix later; doing it now, against a codebase that already compiles
clean, is the cheapest it will ever be.

### Tasks (ordered)

1. **B2 — strict mode.** Set `"strict": true` in `tsconfig.json`. Run
   `npx tsc --noEmit` and resolve fallout. Known spots from review:
   `RootLayout({ children })` in `layout.tsx` needs
   `{ children }: { children: React.ReactNode }`; the `metadata` export should be
   typed `Metadata`; audit the `as unknown as RecipeDetail[]` cast in
   `matches/page.tsx` for a cleaner type. Expect few surprises — the code is
   already largely strict-ready.
2. **B7 — test harness.** Add a test runner (Vitest recommended; zero-config with
   the existing TS setup). Write focused tests for the matcher logic, since that's
   the non-trivial, high-value surface:
   - derivation resolution (owning `orange` ⇒ `orange twist` is `have` with
     `derived_from = 'orange'`) — the case we hand-verified,
   - a substitution hop, a staple, and the zero-overlap exclusion in `match_recipes`.
     These run against a local Supabase instance seeded from `seed.sql` +
     `seed_test_recipes.sql`.
3. **B7 — CI.** Add a GitHub Actions workflow running `lint`, `build`, and the
   test suite on pull requests.

### Acceptance criteria

- `"strict": true` and `npx tsc --noEmit` exits clean.
- `npm run lint` and `npm run build` still pass.
- At least the four matcher cases above pass in CI.
- CI runs lint + build + test on PRs and blocks on failure.

### Cautious decisions

- Keep test scope to the matcher and any pure helpers — do **not** attempt
  component/E2E tests in this phase; that's scope the plan doesn't need yet.
- If strict fallout turns out larger than expected, land it as its own PR ahead of
  the test/CI PR within this phase, rather than expanding the phase.

---

## Phase 2 — Static Rendering, SEO & Sharing

**Items:** B3 (metadataBase) · B1 (SSG recipe pages) · A1 (sitemap + robots) · A5 (share/copy)
**Workload:** Medium–Large · **Balance:** 2A / 2B

### Why paired / why here

One coherent story: **make recipe pages fast and findable, then make them easy to
share.** All four touch the recipe route surface and the metadata layer.
`metadataBase` (B3) is the prerequisite primitive — canonical URLs and absolute OG
images need it — so it leads. SSG (B1) changes how those same detail pages render.
sitemap/robots (A1) exposes the routes that now have proper metadata. Share/copy
(A5) is the demand side of the same discoverability goal and edits the same
`[slug]` page, so it rides along here instead of becoming an orphan feature.

### Prerequisites

Phase 1 complete. Introduce `NEXT_PUBLIC_SITE_URL` (see globals).

### Tasks (ordered)

1. **B3 — metadataBase.** In `layout.tsx`, type `metadata` as `Metadata` and add
   `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")`.
   In `recipes/[slug]/page.tsx` `generateMetadata`, add
   `alternates: { canonical: '/recipes/' + slug }`.
2. **B1 — SSG detail pages.** In `recipes/[slug]/page.tsx`, add
   `generateStaticParams()` returning all published slugs
   (`.from("recipes").select("slug").eq("is_published", true)`), and
   `export const revalidate = 3600` (tune later, or move to on-demand
   revalidation triggered after the offline pipeline runs). Confirm the
   `RecipePantryStatus` client island still overlays live pantry status on the now
   static shell — SSG affects only the server-rendered shell + metadata, not the
   client island.
3. **A1 — sitemap + robots.** Add `app/sitemap.ts` (async): all published recipe
   URLs with `lastModified` from `recipes.updated_at`, plus static routes `/`,
   `/recipes`, `/matches`, `/login`. **Exclude** user-specific/private routes
   (`/favorites`, `/auth/*`). Add `app/robots.ts` allowing all and pointing at
   `${SITE_URL}/sitemap.xml`.
4. **A5 — share/copy.** New client component `share-button.tsx` on the detail page:
   use `navigator.share` when available, else `navigator.clipboard.writeText`
   with a transient "Copied" state. No new data.

### Acceptance criteria

- Recipe detail routes are statically generated (build output shows them as
  prerendered/ISR, not `ƒ` dynamic) and still show live "in your bar" status.
- `/sitemap.xml` lists every published recipe and no private routes; `/robots.txt`
  references it. Both resolve against `NEXT_PUBLIC_SITE_URL`.
- Each recipe page emits a canonical tag and absolute OG image URL.
- Share button copies the canonical URL (or invokes native share) from a recipe page.

### Cautious decisions

- Leave the `/recipes` list route dynamic (it depends on search/pagination
  params). Do **not** try to statically generate the paginated list in this phase.
- Set `revalidate` conservatively (1h) rather than `force-static`, so pipeline
  updates still surface without a redeploy. Note on-demand revalidation as the
  follow-up, not a Phase 2 requirement.
- Keep `dynamicParams = true` (default) so a brand-new slug not yet in
  `generateStaticParams` still renders via ISR instead of 404ing.

---

## Phase 3 — Catalog Browse & Shared Card

**Items:** B6 (extract RecipeCard) · A3 (sort/filter on `/recipes`)
**Workload:** Medium · **Balance:** 1A / 1B

### Why paired / why here

A3 reworks the catalog's list rendering to add sorting and filtering; B6 extracts
the recipe-card markup that's currently copy-pasted across `/recipes`,
`/favorites`, and the matches page. Doing **B6 first** means the new filtered
results — and the other two consumers — all render one canonical card, so a future
style change is a one-file edit. This is the phase where we're already deepest in
list-rendering code, making it the natural home for the extraction.

### Prerequisites

Phase 1 complete.

### Tasks (ordered)

1. **B6 — RecipeCard.** Create `components/recipe-card.tsx` encapsulating the
   **common** card shell: image (`next/image`, `aspect-[3/2]`), name +
   `FavoriteHeart`, `method · glass` line, description. Refactor `recipes/page.tsx`
   and `favorites/page.tsx` to use it. For the matches page, have `MatchCard`
   compose the shared shell and keep its **matches-specific** body (ingredient
   chips with missing-highlighting, the status pill) as a passed-in slot/children.
2. **A3 — sort/filter.** Extend `recipes/page.tsx` (server) to read `sort` and
   `method`/`glass` search params and apply them to the query (`.order(...)` for
   sort; `.eq(...)`/`.in(...)` for the facets — both are plain `recipes` columns).
   Supported sorts: name A–Z (default) and newest (`created_at desc`). Update
   `recipes-filter.tsx` to render the controls and push them into the URL
   (preserving the existing debounced `q`). Keep `is_published = true` on the query.

### Acceptance criteria

- One `RecipeCard` component; `/recipes`, `/favorites`, and matches all render
  through it (matches via the slot pattern) with no visual regression.
- `/recipes` supports sort (name / newest) and filter by method and glass, all
  reflected in the URL and surviving refresh, composable with the existing search.
- The paginated `count` respects the active filters.

### Cautious decisions

- **Do not over-abstract the card.** The matches card is materially different
  (ingredient chips, missing state); RecipeCard owns only the shared shell and
  exposes a children/footer slot. Resist collapsing the matches body into it.
- **Scope A3 to `recipes` columns only** (method, glass, sort). Faceting by
  spirit/ingredient category requires a join on the embedded `recipe_ingredients →
ingredients.category` and is explicitly **deferred** — mark it as a stretch and
  do not ship a half-working join under time pressure.

---

## Phase 4 — Matches Loop & Fetch Optimization

**Items:** B5 (collapse two-query fetch) · A2 (add-missing shopping list) · A4 (surprise-me)
**Workload:** Large (heaviest phase) · **Balance:** 2A / 1B

### Why paired / why here

Everything here lives on or feeds the **matches surface**. B5 fixes the client
waterfall (RPC → second `recipes.in(...)`) on `/matches` and `/favorites`; A2 adds
the "add missing to shopping list" affordance that consumes the very
`missing_ingredients` the matches page already computes; A4 draws a random recipe
from the same ready set. Ordering B5 first gives A2 a clean, single-fetch matches
render to attach its buttons to. This is the app's core loop — keeping it whole in
one phase matters more than trimming the phase's size.

### Prerequisites

Phase 1 complete; Phase 3's RecipeCard (A2 adds an affordance to match cards).

### Tasks (ordered)

1. **B5 — collapse the fetch.** Eliminate the two-step fetch on `/matches` and
   `/favorites`. Preferred: a companion RPC that returns ranked recipes **with**
   the card fields (and, for matches, ingredients) in one round trip; acceptable
   fallback: a single `select` with the needed embed keyed off the RPC's returned
   IDs. Preserve the existing RPC ranking order.
2. **A2 — shopping list.** New `lib/shopping/store.ts`, anonymous/localStorage-only
   (key `recipeace.shopping.v1`), mirroring the anonymous pantry store. Public API:
   `useShopping`, `addToShopping`, `removeFromShopping`, `clearShopping` — all
   keyed by ingredient **name** (see globals). Add an "add missing" action to match
   cards (from `missing_ingredients`) and to the detail page's
   `RecipePantryStatus` missing rows (from each row's `name`). Add a lightweight
   `/shopping` view (or header affordance) to see and clear the list.
3. **A4 — surprise-me.** On `/matches`, add a "Surprise me" control that picks a
   random recipe from the current `missing_count === 0` set and navigates to it;
   disabled (with a hint) when nothing is ready. Uses the already-loaded matches
   data — no new fetch.

### Acceptance criteria

- `/matches` and `/favorites` each issue a single data round trip per
  pantry/filter change, with identical ranking and rendering to before.
- Missing ingredients can be added to the shopping list from both the matches
  cards and the recipe detail page; the list persists across reloads and can be
  cleared; deduped by name.
- "Surprise me" opens a random makeable recipe when at least one is ready.

### Cautious decisions

- **Shopping list stays anonymous/localStorage-only for now.** It deliberately
  does **not** register an auth listener, so it's decoupled from the Phase 5 auth
  work. DB-backed sync for signed-in users is a noted follow-up, explicitly out of
  scope here (avoids coupling and scope creep).
- **This is the heaviest phase and is splittable** if workload is a concern: land
  B5 + A4 as one PR (matches optimization + the small addition) and A2 as a second
  PR within the phase. Keep all three in this phase for continuity, but they need
  not be one commit.
- A4 lives on `/matches`, not the home page, because that's where the ready set is
  already computed — putting it on `/` would force a redundant fetch.

---

## Phase 5 — Client State & Home Cold-Start

**Items:** B4 (unify auth listeners) · A6 (empty-bar starter suggestions)
**Workload:** Medium · **Balance:** 1A / 1B

### Why paired / why here

Both touch the client-state foundation and the home surface that consumes it. B4
replaces the two independent `onAuthStateChange` registrations (one in the pantry
store, one in favorites) with a single shared auth source; A6 adds the empty-bar
starter experience to the home page, which reads that same client state. Grouping
them concentrates all store-touching work in one careful phase so we're not
refactoring stores twice across the plan. B4 goes first so A6 builds on the settled
store shape.

### Prerequisites

Phase 1 complete. A6 introduces a new RPC (below).

### Tasks (ordered)

1. **B4 — unify auth.** Create `lib/auth/store.ts` owning the single
   `supabase.auth.onAuthStateChange` subscription and exposing `user` + `ready` +
   the shared client. Refactor the pantry and favorites stores to subscribe to it
   and run their own domain reactions (pantry: anon→DB migration then load;
   favorites: load) driven by that one event source. **Preserve** the
   `setTimeout(0)` deferral (avoids the known Supabase in-callback deadlock) and
   **all existing public hook signatures** — this is internal only.
2. **A6 — starter suggestions.** Add a new RPC (e.g. `popular_ingredients(limit)`)
   that returns the most-used base ingredients by recipe count (exclude
   staples/garnish). On the home page, when the pantry is empty, render the top N
   as tappable "Popular starting points" chips that add to the pantry on tap.

### Acceptance criteria

- Exactly one auth-state subscription exists across the app; a sign-in/out
  triggers pantry migration/load and favorites load through the single source, and
  every existing store consumer works unchanged.
- On an empty bar, the home page shows tappable popular-ingredient starters that
  add to the pantry; they disappear once the bar is non-empty.
- `npm run build`, lint, and the Phase 1 tests still pass.

### Cautious decisions

- **Frame A6 honestly as "popular starting points," not "unlocks N recipes."**
  True marginal unlock counts for an empty bar are near-meaningless (few recipes
  need only one ingredient), so the RPC uses the defensible metric of
  most-used base ingredients and the copy avoids implying a precise unlock number
  we aren't computing.
- **B4 must be behaviorally invisible.** If unifying introduces any risk to the
  pantry migration-on-sign-in path, prefer leaving the two stores' reaction logic
  exactly as-is and only sharing the subscription — do not refactor the migration
  logic itself in this phase.

---

## Execution notes

- **Strict order:** Phases run 1 → 5. Phase 1 is a hard prerequisite for all
  others; Phase 3 precedes Phase 4 (RecipeCard); Phase 5 is last (store refactor
  after features are built on the frozen public hooks).
- **Heaviest phases:** Phase 4, then Phases 1 and 2. Phase 4 has an explicit
  internal split (B5+A4, then A2) if a single session is too large.
- **Deferred (intentionally out of scope):** ingredient/spirit faceting on the
  catalog (Phase 3 stretch), DB-synced shopping list for signed-in users
  (post-Phase 4), on-demand ISR revalidation wired to the pipeline (post-Phase 2).
- **New surfaces introduced:** `NEXT_PUBLIC_SITE_URL` (P2), `app/sitemap.ts` +
  `app/robots.ts` (P2), `components/recipe-card.tsx` (P3),
  `components/share-button.tsx` (P2), `lib/shopping/store.ts` (P4),
  `lib/auth/store.ts` (P5), `popular_ingredients` RPC (P5).
