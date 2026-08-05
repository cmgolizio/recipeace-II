# restructure-plan.md

Bar / Kitchen separation for **recipeace-II** (`inhousemixes.vercel.app`).
Five phases. Execute **one phase per session**.

This plan sits downstream of `docs/expansion-plan.md`, which is complete
through phase 17 (its tasks 14–16 — dropping the deprecated `recipes`
columns, making the `/recipes` and `/matches` redirects permanent, removing
compatibility code — are deliberately still open and are **not** this plan's
business).

---

## 0. How to use this document

You are an AI executing this plan. On each invocation:

1. Read this entire file first.
2. Find the first phase in **§0.1 Status** that is not `DONE`. That is your
   phase. Ignore all other phases.
3. Verify that phase's **Preconditions**. If any fails, stop and report — do
   not improvise a fix.
4. Make only the changes listed in that phase. Do not refactor adjacent code,
   rename unrelated symbols, reformat untouched files, or "while I'm here"
   anything.
5. Run every command in that phase's **Verification** block. All must pass.
6. Tick the phase's acceptance checkboxes in place, set its Status row to
   `DONE`, and append an entry to **§10 Changelog**.
7. Report in the format of §0.3. Then stop. Do not start the next phase.

If a phase's instructions conflict with what you find in the codebase, **stop
and report the discrepancy**. The codebase is the truth; this plan may have
drifted.

### 0.1 Status

| Phase | Name                                  | Status |
| ----- | ------------------------------------- | ------ |
| 1     | De-cocktail the shared surfaces       | DONE   |
| 2     | The pantry lens                       | DONE   |
| 3     | Move the work into the domains        | TODO   |
| 4     | Domain-scope the remaining queries    | TODO   |
| 5     | Close-out: audit, accessibility, docs | TODO   |

### 0.2 Session prompt template

```text
Read docs/restructure-plan.md in full.

Execute the first phase in §0.1 that is not DONE. That phase only.

Before editing, inspect the current repository and identify any differences
between the plan and the current implementation. The codebase is the truth.

Implement the phase completely, run its Verification block, then report in the
§0.3 format. Do not begin any later phase.
```

### 0.3 End-of-phase report format

- Phase completed.
- Files added / modified / removed.
- Deviations from the plan, and why.
- Verification commands run, and their results.
- Routes manually inspected, and at what viewport / theme.
- Unresolved concerns.
- The next phase (named, not started).

Do not report success when verification is incomplete. If a check fails,
determine whether this phase caused it; fix phase-caused failures and clearly
identify pre-existing ones.

---

## 1. Context — do not re-derive this

### 1.1 Repo facts (verified 2026-08-03)

- Next.js 16 (App Router) + React 19 + TypeScript + Supabase + Tailwind v4.
  Tests are Vitest (`tests/`, `vitest.config.mjs`, `include:
["tests/**/*.test.ts"]`, no jsdom environment). CI at
  `.github/workflows/ci.yml`.
- **`package.json` has four scripts that matter: `lint`, `test`, `build`,
  `dev`. There is no `typecheck` script — typecheck with `npx tsc --noEmit`,
  which is what `docs/expansion-inventory.md` §13 used.**
- **The test suite is 7 test files plus `tests/db.ts`.** `expansion-inventory.md`
  §13 claims "18 files, 157 tests"; that state is not in git history. Baseline
  against the suite that exists, not the one the doc describes.
- Live catalog: **160 cocktails, 13 food recipes.** The Kitchen is real but
  thin. This asymmetry drives several decisions below.
- Route map today: `/` (pantry), `/bar` + `/bar/matches` + `/bar/recipes`,
  `/kitchen` + `/kitchen/matches` + `/kitchen/recipes`, `/search`,
  `/favorites`, `/shopping`, `/recipes/[slug]`, `/ingredients/[slug]`,
  `/login`, `/auth/*`.
- Latest migration is `supabase/migrations/20260806120000_search_recipes.sql`.
  New migrations sort after it.
- `src/lib/analytics.ts` exports a **closed** `AnalyticsEvent` union of three
  events (`domain_switched`, `search_submitted`,
  `shopping_ingredients_added`), each tagged with a `domain` property. Adding
  an event means extending that union.
- `src/components/empty-state.tsx` has exactly three icon keys: `glass`,
  `heart`, `list`. There is no food icon and no pantry icon.
- `src/app/globals.css` defines the token set in **four** places: `:root`,
  `@media (prefers-color-scheme: dark) :root`, `.dark`, and `.light`. An
  `@theme inline` block maps `--color-accent: var(--accent)`, which is why
  rebinding `--accent` on a wrapper works for every `bg-accent` /
  `text-accent` / `border-accent` in the app.
- Both `src/app/bar/matches/layout.tsx` and
  `src/app/kitchen/matches/layout.tsx` exist. They carry the matches pages'
  metadata (those pages are client components) and return `children`
  unwrapped.

### 1.2 What is already correct — DO NOT TOUCH

The domain layer is well built. Leave it alone except where a phase says
otherwise.

- `src/lib/recipes/domain.ts` — `RecipeDomain`, `RECIPE_DOMAINS`,
  `DomainFilter`, `parseDomainFilter`, `isRecipeDomain`, `DOMAIN_SURFACE`,
  `DOMAIN_NOUN`, `DOMAIN_ROUTES`, `matchPills`, `formatMinutes`. Phases 1–4
  **add** to this file; they never rewrite what is there.
- The `/bar` and `/kitchen` route subtrees as a concept.
- `src/components/matches-view.tsx` and its `MatchesCopy` parameterization.
- `src/components/domain-switcher.tsx` — already links (not toggles), already
  carries `aria-current`, already tracks `domain_switched`. It also carries the
  sub-surface across a switch (`/kitchen/matches` → `/bar/matches`, not
  `/bar`); that was fixed outside this plan on 2026-08-04, because landing on
  the hub meant the other side's matcher never ran. Keep that when phase 3.4
  adds the last-domain write.
- Domain-aware SQL: `match_recipes(p_domain)`, `match_recipes_detail(p_domain)`,
  `search_recipes(p_domain)`, `getRecipes({ domain })`. **No phase in this plan
  modifies the matcher.**
- `ingredients.category` is documented as domain-agnostic in
  `20260803120000_food_ingredient_categories.sql`. That is correct and stays
  correct. No phase adds a domain column to `ingredients`.
- The 307 redirects in `next.config.mjs`. Making them permanent is
  expansion-plan phase 17 work, not this plan's.

### 1.3 The problem being fixed

Everything below `/` is a cocktail app with food bolted on:

- `pantry-panel.tsx` — heading `My bar (N)`, `EmptyState icon="glass"` /
  "Your bar is empty", tooltip "Remove from bar", CTA hardcoded to
  `/bar/matches`.
- `ingredient-search.tsx` — badge `✓ In bar`; placeholder examples are all
  cocktail ("bourbon", "midori", "lim"); results are ungrouped so "chicken"
  and "cognac" look identical.
- `almost-there-nudge.tsx` — hardcoded `p_domain: "cocktail"`, "one bottle
  away from N cocktails", links `/bar/matches?missing=1`. A food-only user
  gets nothing.
- `starter-suggestions.tsx` — `popular_ingredients` has **no domain
  parameter**, so at 160:13 it returns an all-cocktail list forever.
- The pantry renders as one flat wall of chips: bourbon, Campari, chicken
  thighs, pasta, undifferentiated.
- Four inputs are called some form of "search": header `search` (recipes), the
  big box on `/` (ingredients), and the name filters inside `/bar/recipes` and
  `/kitchen/recipes`.
- `/bar` and `/kitchen` are thin hubs — two link cards and a paragraph. A
  click tax between the user and the work.
- The header's pantry count is a bare number in a `<span title="...">`. `title`
  is not an accessible name; a screen reader announces "36" with no context.

---

## 2. Binding architectural decisions

These are settled. Do not relitigate them mid-execution.

**D1 — One pantry store. Two lenses. Never two stores.**
Do not split `pantry_items`, `src/lib/pantry/store.ts`, or the localStorage
key. It breaks the "lime juice is one row" constraint the schema is built on,
forces double-adding, and discards the product's best story. The separation is
**presentational**.

**D2 — `/bar` and `/kitchen` become the working surfaces; `/` becomes the
chooser.** Kill the hub cards. Each domain page gets: domain header →
domain-scoped ingredient add → domain-lensed pantry → matches CTA → browse
link. The combined pantry moves to `/pantry`.

**D3 — The lens shows the other side, collapsed — it never hides it.**
On `/bar`: "Your bar (24)" expanded, then "Also in your pantry · 18 kitchen
items" collapsed, with a note that they count toward dinner. This preserves the
shared-pantry story _while_ giving hard visual separation. Hiding the other
domain would make the pantry feel split and lose the differentiator.

**D4 — Ingredient search groups, never filters.**
On `/bar`, typing "egg" must still find eggs (flips, fizzes). Group results
current-domain-first with a small side tag per row. Filtering the other domain
out is a bug, not a feature.

**D5 — Category → domain is a presentation map, not a schema change.**
Lives in `src/lib/pantry/lens.ts`. Deriving real usage from
`recipe_ingredients ⋈ recipes.domain` is strictly more accurate but at 13 food
recipes would render an almost-empty Kitchen shelf. The static map is better
_now_ precisely because the food catalog is thin. **Revisit trigger: the food
catalog passes ~100 published recipes.** The deferred design is preserved in
Appendix B so nobody re-derives it.

**D6 — One accent colour per domain.**
Rebind `--accent` on a wrapper class per subtree. Every existing `bg-accent` /
`border-accent` / `text-accent` inherits it for free.

**D7 — Domain context ranks and groups; it never removes.**
Applies to ingredient search (D4), pantry grouping (D3), and any future
ordering work. A user in the Bar who searches an exact food ingredient by name
must still find it.

**D8 — No shared surface defaults every action toward cocktails.**
Where a shared surface offers a domain action, it offers both, at equal weight,
unless one has no data to show.

**D9 — Reusable domain-parameterized components, never Bar/Kitchen twins.**
The repo already does this well (`matches-view.tsx`, `domain-switcher.tsx`).
Every component this plan touches gains an optional or required `domain` prop
rather than a copy.

**D10 — Domain identity never rests on colour alone.**
Layout, heading, and copy must distinguish `/bar` from `/kitchen` in a
greyscale screenshot. The accent is orientation, not information.

---

## 3. Invariants for every phase

- **Surgical diffs only.** If a line does not need to change, it does not
  change.
- **No new dependencies.** Nothing gets added to `package.json`. In particular:
  there is no jsdom and no testing-library, so **do not write component tests**
  — extract logic into a pure module and test that instead (this is what
  Phase 2 does).
- **No behaviour change to the matcher** or to any existing SQL function except
  where Phase 4 explicitly names one.
- **Hydration safety.** `usePantry` / `usePantryReady` gate every pantry-derived
  render. Never decide "the pantry is empty" before `ready` is true. Follow the
  existing pattern in `home-hero.tsx` and `matches-view.tsx`.
- **Accessibility is not optional.** Existing `aria-current`, `aria-pressed`,
  `aria-expanded`, `aria-activedescendant`, `role="combobox"` /
  `role="listbox"` / `role="option"` semantics must survive every phase.
- **Copy lives in `domain.ts`.** Any new user-facing string that differs by
  domain becomes a `Record<RecipeDomain, string>` there, not an inline ternary
  in a component.
- **Read before you write.** Open the file and read it fully before editing.
  This plan describes intent; the file describes reality.
- Comment style in this repo is explanatory prose about _why_. Match it. Do not
  add `// set the heading` noise.
- **Verification commands, in full, for every phase:**

  ```bash
  npm run lint
  npx tsc --noEmit     # there is no `typecheck` script
  npm test
  npm run build
  ```

---

## 4. Phase 1 — De-cocktail the shared surfaces

**Goal:** remove every hardcoded cocktail assumption from components that are
supposed to be shared. No new architecture. Valuable on its own even if the
plan stops here.

### Preconditions

- Working tree clean.
- `src/components/pantry-panel.tsx`, `ingredient-search.tsx`,
  `almost-there-nudge.tsx` exist and match §1.3.

### Changes

**1.1 — `src/lib/recipes/domain.ts`: add shelf vocabulary.**
Append (do not modify existing exports):

```ts
/** What the user's own stock is called on each side. */
export const DOMAIN_SHELF: Record<RecipeDomain, string> = {
  cocktail: "Your bar",
  food: "Your kitchen",
};

/** The matches CTA, per domain. */
export const DOMAIN_MATCH_CTA: Record<RecipeDomain, string> = {
  cocktail: "See what I can make →",
  food: "See what I can cook →",
};

/** The other side. Two domains, so this is total. */
export function otherDomain(domain: RecipeDomain): RecipeDomain {
  return domain === "cocktail" ? "food" : "cocktail";
}
```

**1.2 — `src/components/pantry-panel.tsx`: accept an optional domain.**

- Signature becomes
  `export function PantryPanel({ domain }: { domain?: RecipeDomain })`.
- Heading: ``domain ? `${DOMAIN_SHELF[domain]} (${pantry.length})` : `Your
pantry (${pantry.length})` ``.
- Empty state: `src/components/empty-state.tsx` currently exposes exactly
  `glass | heart | list`. Map `cocktail` → `glass`; `food` → a new
  food-appropriate key; `undefined` → a new neutral `pantry` key. **Both new
  icons must be added to `ICONS` in the same stroke-based, `currentColor`,
  `viewBox="0 0 24 24"`, `className="size-6"` style as the existing three.** No
  image assets, no dependencies. Title mirrors the heading ("Your bar is empty"
  / "Your kitchen is empty" / "Your pantry is empty").
- Chip tooltip: `"Remove from bar"` → `"Remove from pantry"`.
- CTA:
  - `domain` set → single button to `DOMAIN_ROUTES[domain].matches`, label
    `DOMAIN_MATCH_CTA[domain]`.
  - `domain` undefined → **two** buttons side by side, equal visual weight
    (D8): `DOMAIN_MATCH_CTA.cocktail` to `/bar/matches` and
    `DOMAIN_MATCH_CTA.food` to `/kitchen/matches`. Do not link `/` to itself.
- Leave the toast strings alone — they already say "your pantry".

**1.3 — `src/components/ingredient-search.tsx`.**

- Result badge `"✓ In bar"` → `"✓ In pantry"`.
- Placeholder → `Search ingredients — try "bourbon", "chicken thighs", or
"lim"`. (Phase 2 makes this domain-aware; this is the interim.)
- Nothing else. Do not touch the debounce, the `resultCache`, or the combobox
  keyboard handling.

**1.4 — `src/components/almost-there-nudge.tsx`: require a domain.**

- Signature becomes `({ domain }: { domain: RecipeDomain })` — **required**,
  not optional. A nudge with no domain is meaningless.
- Pass `p_domain: domain` to the RPC.
- Copy from a local record:
  `{ cocktail: "one bottle away from", food: "one ingredient away from" }`,
  pluralising with `DOMAIN_NOUN[domain]`.
- Link: `` `${DOMAIN_ROUTES[domain].matches}?missing=1` ``.
- Update the JSDoc block and the inline comment — they currently say "bar
  nudge counts bottles" and "a changed bar".

**1.5 — `src/app/page.tsx`.** Pass `domain="cocktail"` to `<AlmostThereNudge />`
explicitly. This is an interim call site; Phase 3 relocates it. Leave
`<PantryPanel />` with no `domain` prop (combined view).

**1.6 — `src/app/favorites/page.tsx`.** The empty-state action currently links
`/bar/recipes`. Change to `/search`, label "Browse recipes".

**1.7 — `src/components/ingredient-browse.tsx`.** Rename the local `inBar`
variable to `inPantry` (it appears in the `tone` expression, the click handler,
and `aria-pressed`). Cosmetic, but the word is load-bearing for the next three
phases. No other change — the `CATEGORY_ORDER` array stays exactly as is;
Phase 2 supersedes it.

**1.8 — `src/components/site-header.tsx`: give the count an accessible name.**
The pantry badge is a `<span title={...}>{pantry.length}</span>`. `title` is not
an accessible name on a `span`. Add `aria-label` carrying the same string
(`"36 ingredients in your pantry"` / `"Loading your pantry"`) and keep `title`
for the sighted tooltip. Do not change the badge's placement or styling — that
is out of scope.

### Acceptance criteria

- [x] `PantryPanel` renders correct heading, empty state, and CTA for
      `domain="cocktail"`, `domain="food"`, and `undefined`.
- [x] Two new `EmptyState` icons exist, in the established style, and the
      existing three are unchanged.
- [x] `AlmostThereNudge` with `domain="food"` queries `p_domain: "food"`, says
      "dishes", and links `/kitchen/matches?missing=1`.
- [x] The header pantry count has an accessible name.
- [x] No user-facing string outside `src/app/bar/**` and
      `src/lib/recipes/domain.ts` hardcodes bar/cocktail vocabulary. Verify
      with the grep below and justify every remaining hit.
- [x] Existing tests pass **unchanged** — Phase 1 adds no tests and breaks
      none. (Three pre-existing failures unrelated to this phase were repaired
      first; see the changelog.)

### Verification

```bash
# Every hit must be inside src/app/bar/, src/lib/recipes/domain.ts,
# or a domain-parameterized record. Anything else is a Phase 1 failure.
rg -n -i '\b(my bar|in bar|from bar|bottle|cocktail|drink)\b' src/components src/app \
  --glob '!src/app/bar/**'

npm run lint && npx tsc --noEmit && npm test && npm run build
```

**Manual matrix.** Load `/` in each of four pantry states and confirm the
copy and both CTAs are coherent in every one:

| State                     | Expect                                                   |
| ------------------------- | -------------------------------------------------------- |
| empty                     | neutral pantry empty state, no glass icon                |
| cocktail ingredients only | "Your pantry", both match CTAs                           |
| food ingredients only     | "Your pantry", both match CTAs, no bar-only wording      |
| both                      | as above; nudge still cocktail-scoped (interim, per 1.5) |

---

## 5. Phase 2 — The pantry lens

**Goal:** introduce the category→domain map and use it to split the pantry and
group ingredient search results.

### Preconditions

- Phase 1 is `DONE`.
- `src/lib/recipes/domain.ts` exports `otherDomain`, `DOMAIN_SHELF`, and
  `DOMAIN_MATCH_CTA`.

### Changes

**2.1 — Create `src/lib/pantry/lens.ts`** with exactly this content:

```ts
// src/lib/pantry/lens.ts
//
// Which side of the product an ingredient category *reads* as. Presentation
// only: the matcher never sees this, `ingredients.category` stays
// domain-agnostic in the schema, and a category serving both domains is
// listed under both. Judgment calls: `wine` (deglazing) and `garnish`
// (citrus twists vs. parsley) are deliberately dual.
//
// This is a static map rather than a count derived from
// recipe_ingredients ⋈ recipes.domain, on purpose — see restructure-plan.md
// D5. Revisit when the food catalog passes ~100 published recipes.

import type { Enums } from "../../types/database";
import type { RecipeDomain } from "../recipes/domain";

export type IngredientCategory = Enums<"ingredient_category">;

const CATEGORY_DOMAINS: Record<IngredientCategory, readonly RecipeDomain[]> = {
  // Bar
  spirit: ["cocktail"],
  liqueur: ["cocktail"],
  fortified_wine: ["cocktail"],
  bitters: ["cocktail"],
  mixer: ["cocktail"],
  // Kitchen
  meat: ["food"],
  seafood: ["food"],
  grain: ["food"],
  pasta: ["food"],
  bread: ["food"],
  legume: ["food"],
  canned_good: ["food"],
  oil_and_fat: ["food"],
  sauce: ["food"],
  condiment: ["food"],
  baking: ["food"],
  // Both
  wine: ["cocktail", "food"],
  juice: ["cocktail", "food"],
  syrup: ["cocktail", "food"],
  sweetener: ["cocktail", "food"],
  dairy: ["cocktail", "food"],
  egg: ["cocktail", "food"],
  produce: ["cocktail", "food"],
  herb: ["cocktail", "food"],
  spice: ["cocktail", "food"],
  garnish: ["cocktail", "food"],
  staple: ["cocktail", "food"],
  other: ["cocktail", "food"],
};

export function categoryDomains(
  category: IngredientCategory,
): readonly RecipeDomain[] {
  return CATEGORY_DOMAINS[category] ?? ["cocktail", "food"];
}

export function servesDomain(
  category: IngredientCategory,
  domain: RecipeDomain,
): boolean {
  return categoryDomains(category).includes(domain);
}

/** True when the category reads as belonging to both sides. */
export function isShared(category: IngredientCategory): boolean {
  return categoryDomains(category).length > 1;
}

/**
 * Split a set of categorized items into the current domain's shelf and the
 * other domain's. Shared items land on the current shelf — they are yours
 * here, and the "also in your pantry" group is for the genuinely other side.
 */
export function splitByLens<T extends { category: IngredientCategory }>(
  items: T[],
  domain: RecipeDomain,
): { mine: T[]; other: T[] } {
  const mine: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    (servesDomain(item.category, domain) ? mine : other).push(item);
  }
  return { mine, other };
}
```

The map covers all 28 values of the `ingredient_category` enum (13 from
`20260622120000_initial_schema.sql`, 15 added by
`20260803120000_food_ingredient_categories.sql`). The
`Record<IngredientCategory, ...>` is exhaustive on purpose: if a future
migration adds an enum value and `src/types/database.ts` is regenerated, this
file fails to compile until someone classifies it. That is the intended
behaviour — do not loosen the type to `Partial<Record<...>>`.

Note on `splitByLens`: shared items go on the **current** shelf, not into a
third bucket. Three buckets would strand limes away from the gin, which is not
where a bartender expects them.

**2.2 — Create `tests/pantry-lens.test.ts`.** Follow the conventions in the
existing `tests/*.test.ts` files. Cover:

- `splitByLens([bourbon(spirit), lime(produce), chicken(meat)], "cocktail")` →
  `mine: [bourbon, lime]`, `other: [chicken]`.
- The same input with `"food"` → `mine: [lime, chicken]`, `other: [bourbon]`.
- `isShared("produce") === true`, `isShared("spirit") === false`.
- `categoryDomains("wine")` returns both.
- Input order is preserved within each bucket.
- No DB access — this is a pure unit test, so do not import `tests/db.ts`.
  (It is also the only kind of test this repo can run: there is no jsdom.)

**2.3 — `src/components/pantry-panel.tsx`: split the chips.**

- The `cache` already carries `category`. When `domain` is set, run
  `splitByLens(items, domain)`.
- Render `mine` as the existing chip list under the existing heading.
- Render `other`, when non-empty, inside a `<details>` below it:
  - `<summary>`: `Also in your pantry · ${other.length} ${DOMAIN_SURFACE[otherDomain(domain)].toLowerCase()} item${other.length === 1 ? "" : "s"}`
  - Body: the same chips, plus one muted line —
    `These count toward the ${DOMAIN_SURFACE[otherDomain(domain)]}. One pantry, both sides.`
- The count in the heading stays the **shelf** count (`mine.length`), not the
  total. The header badge in `site-header.tsx` remains the true total — that is
  the correct division of labour and should not change.
- When `domain` is undefined, render the flat list exactly as today.
- Skeleton placeholders for un-fetched ids stay in the `mine` bucket (category
  unknown until fetched).

**2.4 — `src/components/ingredient-search.tsx`: group results.**

- Add optional `domain?: RecipeDomain` prop.
- When set, partition `results` with `splitByLens` and render two labelled
  groups inside the listbox: current domain first (label
  `DOMAIN_SURFACE[domain]`), then the other (label
  `DOMAIN_SURFACE[otherDomain(domain)]`). Omit an empty group entirely.
- Each row gains a small muted tag: the surface name(s) from
  `categoryDomains(r.category)`, or "Both" when shared. This replaces nothing —
  the existing category text stays.
- **Critical:** keyboard navigation must run over the _flattened, rendered_
  order, not per-group. The current code indexes `results` directly in
  `onKeyDown`, in the `active` clamp, and in `aria-activedescendant`. Compute
  `const ordered = domain ? [...mine, ...other] : results` once, derive both
  the groups and every keyboard/ARIA reference from `ordered`, and leave the
  rest of the handler alone.
- When `domain` is undefined, render ungrouped exactly as today.

### Acceptance criteria

- [x] `tests/pantry-lens.test.ts` passes; all pre-existing tests still pass.
- [x] Deleting any key from `CATEGORY_DOMAINS` produces a TypeScript error
      (verify once manually with `npx tsc --noEmit`, then restore).
- [x] With `domain="cocktail"` and a mixed pantry, spirits/liqueurs/produce
      appear on the shelf and meat/pasta appear under the collapsed "Also in
      your pantry" group. (Asserted at the logic level by
      `tests/pantry-lens.test.ts`; not exercised in a browser — see changelog.)
- [x] In `IngredientSearch` with `domain="cocktail"`, typing "egg" still
      returns eggs — grouped, never filtered out (D4/D7). Corrected during
      execution: this criterion said "in the second group", which contradicts
      §2.1's listing of `egg` under Both. A result categorised `egg` (egg
      white) serves the Bar and so ranks in the *first* group; a food-only
      category such as `pasta` (egg noodles) is what lands in the second.
      Nothing is filtered either way, which is the criterion's substance.
- [ ] Arrow-down from the last row of group 1 lands on the first row of
      group 2, and Enter adds it. (Code-verified only — no browser.)
- [ ] `aria-activedescendant` always references the id of the currently
      highlighted row, across groups. (Code-verified only — no browser.)
- [ ] `<details>` is keyboard operable and its summary reads sensibly to a
      screen reader. (Native element, house pattern; not screen-reader tested.)

### Verification

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Manual: with a pantry containing at least one spirit, one produce item, and one
meat item, exercise the two group-crossing keyboard cases above.

---

## 6. Phase 3 — Move the work into the domains

**Goal:** `/bar` and `/kitchen` become the real working surfaces. `/` becomes a
chooser. `/pantry` holds the combined view. Each domain gets its own accent.

### Preconditions

- Phase 2 is `DONE`.
- `src/lib/pantry/lens.ts` exists and is used by `PantryPanel`.

### Changes

**3.1 — Create `/pantry`.** New `src/app/pantry/page.tsx`: the combined view
lifted from today's `/`. Renders `<IngredientSearch />` (no domain),
`<IngredientBrowse />`, `<PantryPanel />` (no domain), and `<AuthMessage />`.
Add `metadata` with `alternates: { canonical: "/pantry" }` matching the
conventions in `src/app/bar/page.tsx`, title via `pageTitle("Your pantry")`.

**3.2 — `/bar` and `/kitchen` become working surfaces.**

- Delete the two hub link cards from each page.
- Keep the existing async server-side `getRecipes(..., { pageSize: 1 })` count
  and the header sentence.
- Keep the Kitchen's `total === 0` "Still being stocked" branch.
- Below the header, render in order:
  1. `<IngredientSearch domain="cocktail" | "food" />`
  2. `<StarterSuggestions />` (gains its domain in Phase 4)
  3. `<PantryPanel domain="cocktail" | "food" />`
  4. `<AlmostThereNudge domain="cocktail" | "food" />`
  5. A single text link to `DOMAIN_ROUTES[domain].recipes`
     ("Browse the full catalog →")
- Delete the "Your pantry is shared with the Kitchen/Bar" paragraph from both —
  Phase 2's collapsed group now carries that message in the right place.
- Server components rendering client children is fine; no `"use client"` is
  added to these pages.

**3.3 — `/` becomes the chooser.** Rewrite `src/app/page.tsx`:

- `<HomeHero />` (unchanged — it already self-hides for a stocked pantry).
- `<AuthMessage />` stays.
- A new client component `src/components/domain-summary-cards.tsx`: two cards,
  Bar and Kitchen, each linking to its domain home. Each card shows, once the
  pantry is hydrated and non-empty, `N ingredients · M ready` — where `N` is
  `splitByLens(...).mine.length` and `M` comes from
  `match_recipes_detail({ pantry, max_missing: 0, p_domain })`. Fire both RPCs
  in parallel, show a skeleton while loading, and degrade silently to a plain
  card on error or empty pantry. Follow the `key`-and-derive-during-render
  pattern used by `almost-there-nudge.tsx` so a stale response never lands.
  **No new RPC** — `match_recipes_detail` already takes everything needed.
- A muted link to `/pantry` — "See everything in your pantry".
- Remove `IngredientSearch`, `IngredientBrowse`, `PantryPanel`,
  `StarterSuggestions`, `AlmostThereNudge` from this page.

**3.4 — Last-domain affordance.** New `src/lib/domain/last.ts`: localStorage key
`recipeace.domain.v1`, read/write helpers, same defensive try/catch as the
other stores. Written on click by `DomainSwitcher` and on mount by the two
domain surfaces. `/` reads it client-side and, when set, renders a "Continue in
the Bar →" / "Continue in the Kitchen →" link above the cards.

> **Do not auto-redirect.** An earlier proposal was to send `/` to the last
> domain for a stocked pantry. It makes `/` unreachable, breaks the back button
> out of a domain, and fights the browser's cache. The affordance gets the same
> ergonomics with none of the cost.

**3.5 — Per-domain accent.**

- `src/app/globals.css` defines the token set in **four** blocks: `:root`,
  `@media (prefers-color-scheme: dark) :root`, `.dark`, and `.light`. Add
  `--accent-bar`, `--accent-bar-foreground`, `--accent-kitchen`, and
  `--accent-kitchen-foreground` to **all four**, so an explicit theme choice
  still wins. Keep the existing indigo as the Bar accent; pick a warm
  counterpart for the Kitchen.
- Every pair must hold ≥ 4.5:1 contrast between accent and accent-foreground,
  in both themes. State the measured ratios in the phase report.
- Add `.domain-bar { --accent: var(--accent-bar); --accent-foreground:
var(--accent-bar-foreground); }` and `.domain-kitchen { ... }` after the
  theme blocks.
- Create `src/app/bar/layout.tsx` and `src/app/kitchen/layout.tsx` that wrap
  `children` in a `div` carrying the class. **First read
  `src/app/bar/matches/layout.tsx` and `src/app/kitchen/matches/layout.tsx`** —
  both already exist and hold their pages' metadata; the new parents must
  compose with them, not duplicate or override that metadata.
- Do not change any component's `bg-accent` / `text-accent` / `border-accent`
  classes. The `@theme inline` mapping of `--color-accent: var(--accent)` is
  the whole mechanism.

**3.6 — Navigation and sitemap.**

- `src/components/site-header.tsx`: the `pantry` link (desktop `NavLink` and
  mobile `MenuLink`) points at `/pantry`, not `/`. Its `exact` prop is no
  longer needed. The logo keeps linking to `/`.
- `src/app/sitemap.ts`: add `/pantry` to `staticRoutes`.
- Repoint every internal link to `/` that means "the pantry". As of this
  writing that is:
  - `src/components/matches-view.tsx` (empty-pantry message)
  - `src/components/recipe-pantry-status.tsx` (empty-pantry message)
  - `src/app/bar/page.tsx` and `src/app/kitchen/page.tsx` (deleted in 3.2)
  - `src/app/ingredients/[slug]/page.tsx`
  - `src/app/ingredients/[slug]/not-found.tsx`
    Re-run the grep in Verification and justify each surviving hit — the logo and
    any genuine "go home" link are legitimate.

### Acceptance criteria

- [ ] An ingredient added on `/bar` is immediately visible on `/kitchen` and
      `/pantry` with no reload. (Same store — verify, do not assume.)
- [ ] `/bar` and `/kitchen` are distinguishable in a **greyscale** screenshot
      through layout and copy, not hue alone (D10).
- [ ] `/` renders the chooser with live counts for a stocked pantry and the
      hero for an empty one, with no flash of either during hydration.
- [ ] `/pantry` reproduces the pre-Phase-3 `/` experience.
- [ ] Every accent-coloured element inside `/bar/**` uses the bar accent and
      inside `/kitchen/**` the kitchen accent, in both light and dark, with the
      contrast ratios recorded.
- [ ] Matches-page metadata is unchanged — the new layouts compose with the
      existing `matches/layout.tsx` files.
- [ ] No auto-redirect exists anywhere. Navigating to `/` always renders `/`.
- [ ] Existing tests pass unchanged.

### Verification

```bash
rg -n 'href="/"' src/components src/app     # each remaining hit must mean "home", not "pantry"
rg -n 'accent' src/app/globals.css          # both domain vars in all four theme blocks
npm run lint && npx tsc --noEmit && npm test && npm run build
```

**Manual matrix.** `/`, `/bar`, `/kitchen`, `/pantry` × {empty pantry, cocktail-
only, food-only, both} × {light, dark}. Confirm no hydration flash and no
zero-count card rendering as a real zero when data is simply unavailable.

---

## 7. Phase 4 — Domain-scope the remaining queries

**Goal:** remove the last place where the Kitchen is structurally invisible, and
stop calling four different things "search".

### Preconditions

- Phase 3 is `DONE`.
- Supabase CLI is available and the project is linked (needed for type
  regeneration).

### Changes

**4.1 — Migration:
`supabase/migrations/20260807120000_popular_ingredients_domain.sql`.**

`popular_ingredients` was created with `create function` and a defaulted
`max_results`. Adding a second defaulted parameter creates an **ambiguous
overload**, so the old signature must be dropped first:

```sql
-- popular_ingredients gains a domain filter. Without it the starter strip
-- counts across the whole catalog, and at 160 cocktails to 13 dishes that
-- means the Kitchen's suggestions are always somebody else's bottles.
--
-- Dropped rather than replaced: adding a second defaulted argument to the
-- existing signature would leave two candidate functions and make the
-- one-argument call ambiguous.

drop function if exists public.popular_ingredients(int);

create function public.popular_ingredients(
  max_results int default 8,
  p_domain public.recipe_domain default null
)
returns table (
  id           bigint,
  name         text,
  recipe_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.name, count(*) as recipe_count
  from public.recipe_ingredients ri
  join public.recipes r on r.id = ri.recipe_id and r.is_published
  join public.ingredients i on i.id = ri.ingredient_id
  where not ri.is_optional
    and not ri.is_garnish
    and not i.is_staple
    and i.category <> 'garnish'
    and (p_domain is null or r.domain = p_domain)
  group by i.id, i.name
  order by recipe_count desc, i.name asc
  limit greatest(1, least(coalesce(max_results, 8), 50));
$$;

comment on function public.popular_ingredients(int, public.recipe_domain) is
  'Ingredients required by the most published recipes (optional/garnish uses '
  'ignored; staples and garnishes excluded), optionally scoped to one domain. '
  'For empty-pantry starter suggestions.';

grant execute on function public.popular_ingredients(int, public.recipe_domain)
  to anon, authenticated;
```

Verify against the original file `20260722120000_popular_ingredients.sql` before
writing — the body above must differ from it **only** by the `p_domain`
predicate. (`recipes.domain` is NOT NULL as of
`20260801120000_recipe_domain.sql`, so the predicate is unambiguous either way.)

**4.2 — Regenerate `src/types/database.ts`** with the Supabase type generator.
Commit the regenerated file. If the generator is unavailable, **stop and
report** — do not hand-edit the generated types.

**4.3 — `tests/popular-ingredients.test.ts`.** Read it, then extend: existing
no-domain assertions must still hold, plus a scoped case proving
`p_domain: 'food'` returns only ingredients used by food recipes, and a case
proving `popular_ingredients(8)` and `popular_ingredients(8, null)` agree.

**4.4 — `src/components/starter-suggestions.tsx`.**

- Add optional `domain?: RecipeDomain`; pass `p_domain: domain ?? null`.
- The module-level `starterCache` is a single value and would now serve the
  wrong domain's list. Change it to `Map<string, Starter[]>` keyed by
  `domain ?? "all"`.
- Update the JSDoc and the two inline comments — they say "for an empty bar"
  and "once the bar has anything in it".
- Pass the domain from `/bar` and `/kitchen` (added structurally in 3.2).

**4.5 — Rename the recipe search in navigation.**
`src/components/site-header.tsx`: the `search` label becomes `find a recipe` in
both the desktop `NavLink` and the mobile `MenuLink`. The route stays `/search`.

**4.6 — Scope search links out of a domain.** From `/bar` and `/kitchen`, any
link to `/search` carries `?domain=cocktail` / `?domain=food`.
`src/app/search/page.tsx` already parses this via `parseDomainFilter` and
`SearchForm` already reflects it in its tabs — verify, change nothing there.

**4.7 — Analytics.** `src/lib/analytics.ts` exports a closed `AnalyticsEvent`
union. Extend it by exactly one event, `domain_home_selected`, fired by
`domain-summary-cards.tsx` on card click with `{ domain }`. Do not add more:
`domain_switched` already covers the header switcher, and the repo's stated
posture (`expansion-plan.md` §17) is deliberately thin analytics. Record no raw
search text.

**4.8 — Leave the catalog filters alone.** `/bar/recipes` (`RecipesFilter`) and
`/kitchen/recipes` (`FoodFilter`) keep their own name inputs. They are catalog
browsers, not search; their facets are legitimately different. Do not unify
them.

### Acceptance criteria

- [ ] `popular_ingredients(8, 'food')` returns only ingredients used by
      published food recipes.
- [ ] `popular_ingredients(8)` and `popular_ingredients(8, null)` return
      exactly what the pre-migration function returned.
- [ ] No ambiguous-function error from PostgREST on any call form.
- [ ] `src/types/database.ts` is regenerated, not hand-edited.
- [ ] The starter strip on `/kitchen` shows food ingredients; on `/bar`, bar
      ingredients; switching between them does not serve a cached wrong-domain
      list.
- [ ] Header reads "find a recipe"; the ingredient input on the domain surfaces
      is the only thing labelled around adding ingredients.
- [ ] `AnalyticsEvent` grew by exactly one member.
- [ ] Full test suite passes.

### Verification

```bash
rg -n 'popular_ingredients' src supabase tests   # every call site passes or omits p_domain deliberately
# apply the migration locally, then:
npm run lint && npx tsc --noEmit && npm test && npm run build
```

---

## 8. Phase 5 — Close-out: audit, accessibility, docs

**Goal:** prove the restructure is coherent, not just individually shipped.
This phase writes no features.

### Preconditions

- Phase 4 is `DONE`.

### 8.1 Terminology audit

```bash
rg -n -i '\b(my bar|your bar|in bar|from bar|inBar|stocked bar|empty bar|bottle)\b' \
  src tests docs scripts
```

Classify **every** hit into one of five buckets and record the classification in
the phase report:

1. Legitimate Bar-workspace wording (`src/app/bar/**`, `DOMAIN_SHELF.cocktail`).
2. Obsolete shared-pantry wording → fix.
3. Historical documentation (`docs/expansion-*.md`) → leave.
4. Test fixture → leave unless misleading.
5. Internal variable → rename only if the word is load-bearing.

### 8.2 Route audit

Walk `/`, `/pantry`, `/bar`, `/bar/matches`, `/bar/recipes`, `/kitchen`,
`/kitchen/matches`, `/kitchen/recipes`, `/search`, `/favorites`, `/shopping`,
`/recipes/[slug]`, `/ingredients/[slug]`, `/login`. For each, check: metadata
and canonical, active nav state, empty state, loading state, error state.
Confirm `/recipes` and `/matches` still 307 with query strings preserved.

### 8.3 Pantry synchronization audit

Anonymous persistence; cross-tab localStorage updates; sign-in migration;
authenticated persistence; sign-out. Add from `/bar`, from `/kitchen`, from
`/pantry`; remove from each; clear. Assert no duplicate ids and that the header
badge always equals the true total while each shelf shows its own count.

### 8.4 Accessibility sweep

- Heading hierarchy on every restructured page (one `h1`, no skipped levels).
- `aria-current` on both nav layers.
- Combobox: `role`, `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  Arrow/Enter/Escape, focus retention after add — across groups (Phase 2).
- `<details>` summary is focusable and announces its state.
- Header pantry count has an accessible name (Phase 1.8).
- Contrast ≥ 4.5:1 for both domain accents in both themes (Phase 3.5).
- Colour is never the only domain cue (D10).
- `prefers-reduced-motion` still honoured.
- Touch targets ≥ 44px on the chooser cards at 375px.

### 8.5 Performance check

No duplicate pantry queries on a single render; no full-catalog fetch to
produce a count; no N+1 in `PantryPanel`'s detail cache; the two chooser RPCs
fire in parallel and are keyed so a stale response can't land; no hydration
mismatch; static generation unchanged (`npm run build` route count).

### 8.6 Documentation

Update `README.md` and append a section to `docs/expansion-inventory.md` §12
covering: one shared pantry, two workspaces; the `/pantry` route; the lens as a
presentation map and why it isn't derived (D5, with the ~100-recipe revisit
trigger); the domain-parameterized component pattern; how to add a third domain.

Correct `docs/expansion-inventory.md` §13's test-suite claim to match reality.

### Acceptance criteria

- [ ] Every terminology hit is classified and the obsolete ones are fixed.
- [ ] Every route in 8.2 checked, with findings recorded.
- [ ] The pantry sync matrix in 8.3 passes end to end.
- [ ] The a11y sweep in 8.4 passes, with contrast ratios recorded.
- [ ] `npm run build` route count is understood and any change explained.
- [ ] Docs updated; no doc claims a test file that doesn't exist.
- [ ] No dead code left from Phases 1–4 (old hub-card class constants, unused
      imports, superseded `CATEGORY_ORDER` entries if genuinely unreferenced).

---

## 9. Explicitly out of scope

Do not do any of these, in any phase, even if they look adjacent:

- **Renaming the site.** "In House Mixers" is cocktail-branded and will fight
  this eventually, but a rename is a domain/SEO/analytics project, not a UI
  one — and it is the wrong spend while food is 13 recipes deep. Revisit when
  the Kitchen can carry its own weight.
- **Deriving ingredient affinity from recipe usage.** See D5 and Appendix B.
- **A mobile bottom navigation, a domain badge/icon component system, or a
  header restructure.** Each is its own project. The header changes in this
  plan are two link repoints and one label.
- Splitting the pantry store, table, or localStorage key (contradicts **D1**).
- Adding a domain column to `ingredients` or otherwise making `category`
  domain-owned (contradicts **D5** and the migration's own documented
  constraint).
- Modifying `match_recipes`, `match_recipes_detail`, `recipe_pantry_status`,
  `search_recipes`, or any derivation SQL.
- Unifying `/bar/recipes` and `/kitchen/recipes` filters.
- Expansion-plan phase 17 cleanup: dropping deprecated `recipes` columns,
  making the 307s permanent, removing compatibility code.
- DB-backed sync for the shopping list.
- Adding dependencies, changing the test runner, or reformatting files the
  phase does not touch.

---

## Appendix A — Copy guidelines

Use these consistently. Anything domain-varying lives in `domain.ts`.

**Shared inventory.** Pantry · Your pantry · In pantry · Add to pantry ·
Remove from pantry · See everything in your pantry.
Never, on a shared surface: My bar · In bar · Remove from bar · Your bar is
empty.

**Cocktail domain.** The Bar · Your bar · Cocktails · See what I can make ·
Browse the full catalog · one bottle away from.

**Food domain.** The Kitchen · Your kitchen · Food recipes · See what I can
cook · Browse the full catalog · one ingredient away from.
Never "bottle" for food.

**Recipe discovery.** find a recipe · Cocktails · Food · Everything.

**Crossover.** Both · Also in your pantry · These count toward the Kitchen.
Never phrasing that implies the ingredient is duplicated or that the pantry is
split.

---

## Appendix B — Deferred: derived ingredient affinity

Preserved so it doesn't get re-derived. **Do not implement under this plan.**
Trigger: the food catalog passes ~100 published recipes (D5).

Compute affinity through the relationship that already exists —
`ingredients → recipe_ingredients → recipes.domain` — rather than the static
map in `lens.ts`:

```text
ingredient_id
cocktail_recipe_count
food_recipe_count
affinity  -- 'cocktail' | 'food' | 'shared' | 'unused'
```

Strict rules beat percentage thresholds for a first version: both counts > 0 →
`shared`; only cocktails → `cocktail`; only food → `food`; neither →
`unused`.

When it lands, it should:

- Replace `CATEGORY_DOMAINS` as the input to `splitByLens`, keeping that
  function's signature so callers don't change.
- Optionally extend `search_ingredients` to return the counts and rank by them
  — but text-match quality must always outrank domain relevance (D7).
- Respect existing RLS; the derived data is only as public as the recipe and
  ingredient catalog already is.
- Ship with DB tests for each of the four affinity cases plus recount-on-recipe-
  deletion.

Until then, the static map is the answer, and a category serving both sides is
listed under both.

---

## 10. Changelog

Append one entry per completed phase. Newest last.

```
<!-- Phase N — YYYY-MM-DD
     Files touched:
     Deviations from plan (and why):
     Verification results:
     Manual inspection:
-->
```

<!-- Phase 1 — 2026-08-04
     Files touched:
       src/lib/recipes/domain.ts       (1.1 — DOMAIN_SHELF, DOMAIN_MATCH_CTA,
                                        otherDomain appended)
       src/components/empty-state.tsx  (1.2 — new `pot` and `pantry` icons)
       src/components/pantry-panel.tsx (1.2 — optional domain prop)
       src/components/ingredient-search.tsx (1.3)
       src/components/almost-there-nudge.tsx (1.4 — required domain prop)
       src/app/page.tsx                (1.5)
       src/app/favorites/page.tsx      (1.6)
       src/components/ingredient-browse.tsx (1.7 — inBar → inPantry)
       src/components/site-header.tsx  (1.8 — aria-label on the count)
       src/app/recipes/[slug]/not-found.tsx (deviation, below)
       tests/matcher.test.ts, tests/ingredient-detail.test.ts,
       tests/related-recipes.test.ts   (pre-existing failures, below)

     Deviations from plan (and why):
       - Preconditions: the working tree was NOT clean-and-green at the start.
         `npm test` had three failures predating this phase, red in CI since
         2026-08-01. They were repaired before Phase 1 began, because the
         phase's own Verification block cannot otherwise pass. All three were
         stale tests, not product bugs: match_recipes_detail and
         ingredient_detail return a domain-shaped `metadata` object instead of
         bare method/glass columns (20260801120200, 20260802120100), and
         related_recipes reads base_spirit from cocktail_recipe_details rather
         than the deprecated column on `recipes` (20260802120000). No
         migration, RPC or component behaviour was changed.
       - 1.4 pluralises with a local record rather than `DOMAIN_NOUN[domain]`
         + "s". DOMAIN_NOUN.food is "dish", which does not take a bare "s";
         deriving it would render "dishs" and fail the phase's own acceptance
         criterion ("says 'dishes'"). The singular still comes from
         DOMAIN_NOUN.
       - 1.4 also folds the domain into the stale-response key and the effect
         deps. The key exists to stop a response landing against state it
         wasn't fetched for, and the domain now selects which catalog is
         counted.
       - 1.8 uses "N ingredients in your pantry" for both `aria-label` and
         `title`. The plan quotes that wording for the accessible name and
         asks that title carry the same string; the old title said "N in your
         pantry".
       - One change outside 1.1–1.8: `src/app/recipes/[slug]/not-found.tsx`
         said "There's no cocktail here" on the *shared* recipe route, so a
         missing food recipe was told it was a missing cocktail. It is an
         unjustifiable hit in the acceptance grep, so the string was made
         domain-neutral. Nothing else on that page was touched.

     Verification results:
       npm run lint      — pass
       npx tsc --noEmit  — pass
       npm test          — pass (7 files, 43 tests)
       npm run build     — pass, 23 routes (unchanged)
       Terminology grep  — every remaining hit is a domain-parameterized
         record (NUDGE_COPY, SHELF_ICON, DOMAIN_ROUTES/DOMAIN_MATCH_CTA reads
         with both sides at equal weight, favorites TABS), a comment naming
         both domains, or the cocktail *branch* of the domain-switched
         /recipes/[slug] page. The one genuine hit was fixed (above). The
         hits in src/app/recipes/page.tsx are the legacy catalog behind the
         307 in next.config.mjs — compatibility code that expansion-plan
         phase 17 removes, explicitly out of scope here (§9).

     Manual inspection:
       NOT RUN. The pantry matrix needs a live Supabase (ingredient details
       and match_recipes_detail are fetched client-side) and this environment
       has no NEXT_PUBLIC_SUPABASE_URL / key. The four-state matrix on `/` and
       the domain-prop variants of PantryPanel are unverified in a browser.
-->

<!-- Phase 2 — 2026-08-05
     Files touched:
       src/lib/pantry/lens.ts          (2.1 — new; verbatim from the plan)
       tests/pantry-lens.test.ts       (2.2 — new)
       src/components/pantry-panel.tsx (2.3 — split shelf + collapsed group,
                                        plus the hydration gate below)
       src/components/ingredient-search.tsx (2.4 — grouped results, plus the
                                        placeholder §1.3 deferred to here)
       src/lib/recipes/domain.ts       (DOMAIN_INGREDIENT_EXAMPLES appended)

     Deviations from plan (and why):
       - 2.3, the heading count. The plan says the heading shows mine.length.
         While ingredient details are still being fetched an id has no
         category, so it cannot be placed; the plan itself puts those
         skeletons in the `mine` bucket. The heading therefore counts
         mine.length + loadingCount, so the number always equals the chips
         rendered beneath it rather than counting up from 0 as details land.
       - 2.3, the empty state. Its condition was `pantry.length === 0`; it is
         now `shelfCount === 0`, which is the same thing when no domain is
         passed. With a domain it also covers the food-only pantry seen from
         the Bar: that shelf really is empty, and rendering a bare `<ul>` with
         a match CTA above the "Also in your pantry" group read as broken.
         The collapsed group renders in that state too, so the other side is
         still visible (D3).
       - 2.3 extracts the chip `<li>` into a local `chip()` function; `mine`
         and `other` render identical chips. Same markup, one copy.
       - 2.4, the row tag renders only when `domain` is set. The section asks
         for a per-row side tag and then says an undefined domain renders
         "ungrouped exactly as today"; the latter is the more specific
         instruction, so `/`'s combined search is untouched by this phase.
       - 2.4 groups are `role="group"` + `aria-labelledby` pointing at the
         visible label, so the listbox's children stay options-within-groups
         and the label is announced with each group.
       - The domain-aware placeholder §1.3 defers to "Phase 2" is done here,
         though §2.4 does not list it: no later phase claims it, so skipping
         it would strand the deferral for good. The varying part lives in
         DOMAIN_INGREDIENT_EXAMPLES in domain.ts per §3's copy invariant; the
         examples are ingredients the seeds really contain (bourbon, midori;
         chicken thigh, olive oil, parmesan cheese), and each list keeps a
         fragment ("lim", "parm") because the search matches partial names.
         The no-domain placeholder is Phase 1's, unchanged.
       - PantryPanel now gates on usePantryReady, which it never did. §3's
         hydration invariant requires it: before hydration the pantry is
         unknown, not empty, and the component was rendering "Your bar is
         empty" at every returning user for a frame. Not-ready renders
         skeleton chips (the aria-hidden, length-3 idiom from matches-view),
         holds the heading count back, and hides Clear all and the collapsed
         group. This is a pre-existing bug the phase's own split made worse —
         with a domain, an unready render also picked a shelf.

     Verification results:
       npm run lint      — pass
       npx tsc --noEmit  — pass
       npm test          — pass (8 files, 47 tests; was 7/43)
       npm run build     — pass, 23 routes (unchanged)
       Exhaustiveness    — removing `bitters` from CATEGORY_DOMAINS fails with
         TS2741 ("Property 'bitters' is missing… but required in type
         Record<…>"); file restored, tsc clean again.

     Plan discrepancy found and corrected in place:
       The acceptance criterion "typing 'egg' … in the second group" did not
       follow from §2.1, which lists `egg` under Both. A result categorised
       `egg` (egg white) serves the Bar and so ranks in the *first* group; a
       food-only category such as `pasta` (egg noodles) is what lands in the
       second. The criterion now says "grouped, never filtered out", which is
       its substance (D4/D7) and is what the code does. §2.1's map is
       unchanged — it is the map that is right here, not the criterion.

     Manual inspection:
       NOT RUN, and doubly blocked. As in Phase 1 there is no
       NEXT_PUBLIC_SUPABASE_URL / key, so neither the ingredient-detail fetch
       nor search_ingredients returns anything in this environment; and no
       call site passes `domain` until phase 3.2 mounts these components on
       /bar and /kitchen, so the grouped and split renderings have no route to
       appear on yet. The keyboard cases are code-verified only: `ordered` is
       [...mine, ...other], group 2 renders at offset mine.length, and every
       index, clamp and aria-activedescendant reads `ordered`. Phase 5 §8.4
       re-audits the combobox across groups.
-->
