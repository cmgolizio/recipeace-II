# What's In House — UX Plan

## Context

`docs/build-plan.md`, `docs/polish-plan.md`, `docs/polish-plan2.md`,
`docs/expansion-plan.md` and `docs/restructure-plan.md` are complete and in
`main`. The app is architecturally sound: RSC/client-island split, one
`useSyncExternalStore` pattern for every store, deterministic SQL matching,
SSG + SEO on recipe pages, tests, CI. Nothing in this plan is a bug fix for
that work.

This plan closes a different gap: **the app is correct and joyless.** It reads
as a report about food rather than an invitation to make food. This document
replaces the visual identity wholesale, fixes the image pipeline so both
domains actually have pictures, and puts weight on the one moment the product
exists for — "here is what you can make right now."

8 phases. Run in numeric order, one phase per Claude Code session, fresh in the
repo root. `AGENTS.md` / `CLAUDE.md` discipline (simplicity-first, surgical
changes, goal-driven) applies throughout. To execute: "Phases 1–N are complete;
execute Phase N+1."

## Audit findings (measured, not assumed)

Taken from the repo at HEAD and the live deploy on 2026-08-16:

| Finding                             | Number |
| ----------------------------------- | ------ |
| Published cocktails                 | 160    |
| Cocktails with an image             | 155    |
| Published food recipes              | **13** |
| Food recipes with an image          | **0**  |
| Ingredients total                   | 204    |
| Ingredients in food-side categories | ~30    |
| Images on the matches page          | **0**  |

Root causes, not symptoms:

1. **`loadRecipesMissingImages()` reads `cocktail_recipes` only.** Food recipes
   are structurally invisible to the image pipeline. `buildPrompt()` hardcodes
   the word "cocktail" and cocktail-only fields (`glass`, `garnish`).
2. **`MatchesView` never selects `image_url`.** The payoff screen — the entire
   reason the product exists — is the least visual surface in the app.
3. **Missing ingredients render `text-red-600`.** The loudest colour signal in
   the app is _failure_.
4. **Bar and Kitchen differ by exactly one hue token.** Everything else —
   layout, type, density, background — is identical.
5. **Nothing accumulates.** Favorites are the only personal state and they are
   account-gated. Visit 40 looks like visit 1.
6. **`gpt-image-1` is retired by OpenAI on 2026-10-23.** The pipeline's default
   model breaks in roughly ten weeks.
7. **`NEXT_PUBLIC_SITE_URL` in production is still `inhousemixes.vercel.app`.**
   Sitemap, robots, canonicals and OG images all point at the dead domain.
   Root cause is not the value but the location: a canonical origin held in a
   deploy dashboard has no reviewer and drifts silently. **Closed in P1** by
   moving it into the repo as a constant.

## Dependency order

```
P1 Palette & token foundation ..... bg/surface/ink, 5 accents, kill domain accent
└─ P2 The accent dealer ........... assignment engine + application (needs P1)
   └─ P6 Type & the two skins ..... display face, Bar/Kitchen split (needs P1+P2)

P3 Image pipeline ................. domain-aware prompts, gpt-image-2, 3:2, backfill
└─ P4 The reveal .................. images on match cards, big count, stagger
   └─ P5 The unlock moment ........ "that unlocks 6 drinks", amber replaces red

P7 Kitchen catalog ................ independent; unblocks P4's value for food
P8 Snap your shelf ................ independent; do last
```

P1 → P2 → P6 is one chain (visual). P3 → P4 → P5 is the other (payoff). The two
chains are independent and may be interleaved if a session runs short. P7 is
independent, but P4's value on the Kitchen side is thin until it lands.

---

## Global decisions — decided once, do not re-litigate

### D1. The palette

Five accents, fixed, no additions:

| Token         | Hex       | Name    |
| ------------- | --------- | ------- |
| `--p-blue`    | `#3772FF` | blue    |
| `--p-magenta` | `#F038FF` | magenta |
| `--p-pink`    | `#EF709D` | pink    |
| `--p-lime`    | `#E2EF70` | lime    |
| `--p-cyan`    | `#70E4EF` | cyan    |

Neutrals:

|                | Light     | Dark (midnight) |
| -------------- | --------- | --------------- |
| `--background` | `#ffffff` | `#0b1026`       |
| `--surface`    | `#ffffff` | `#141a38`       |
| `--foreground` | `#0b1026` | `#f2f4fb`       |
| `--muted`      | `#5b6480` | `#98a1c0`       |
| `--border`     | `#e4e7f0` | `#262e52`       |

Light `--background` and `--surface` are both pure white on purpose. Cards are
delimited by a neutral hairline **and** their accent bar, never by a fill
difference.

### D2. Accents are fills, never hairlines or body text

Measured contrast of each accent against pure white (full table in Appendix B):

| Accent    | vs `#ffffff` | Usable as text or a thin line on white? |
| --------- | ------------ | --------------------------------------- |
| `#3772FF` | 4.19:1       | marginal                                |
| `#F038FF` | 3.13:1       | no                                      |
| `#EF709D` | 2.81:1       | **no**                                  |
| `#E2EF70` | **1.25:1**   | **invisible**                           |
| `#70E4EF` | **1.50:1**   | **invisible**                           |

Against `#0b1026` every accent lands between 4.5:1 and 15.1:1. **Dark mode is
this palette's home; light mode has to be engineered around it.** Therefore:

- **`--accent-foreground` is `#05081a` in both modes.** Ink on an accent fill is
  always near-black. This inverts today's light-mode value (`#ffffff`), and
  every `bg-accent text-accent-foreground` pair inherits the change.
  The value is `#05081a` rather than `--background`'s `#0b1026` for one reason:
  blue against `#0b1026` measures **4.49:1** and misses the 4.5 threshold by a
  hair. `#05081a` puts it at 4.75:1. Blue is the binding constraint everywhere
  in this palette — check it first, always.
- **`--accent-ink`** is what to use when an accent must be _text_ or a _thin
  line_. It is a mix toward the mode's opposite pole, tuned per colour until it
  clears 4.5:1 against `--background`:

Four blocks, not two. The snippet below shows light and `.dark`; the shipped
rules also carry `@media (prefers-color-scheme: dark)` and `.light`, mirroring
the neutrals. Without them a system-dark reader with no theme cookie gets the
light-mode ink, and light lime ink on midnight measures ~2.7:1.

The dark values reference `--p-*` rather than `--accent`: nothing rebinds
`--accent` until P2, so `var(--accent)` would resolve to blue for all four.
The two are the same colour once a wrapper class deals one.

```css
/* light — mix toward near-black; percentages are the accent's share */
.accent-blue {
  --accent-ink: color-mix(in oklab, var(--p-blue) 85%, #0b1026);
}
.accent-magenta {
  --accent-ink: color-mix(in oklab, var(--p-magenta) 72%, #0b1026);
}
.accent-pink {
  --accent-ink: color-mix(in oklab, var(--p-pink) 68%, #0b1026);
}
.accent-lime {
  --accent-ink: color-mix(in oklab, var(--p-lime) 40%, #0b1026);
}
.accent-cyan {
  --accent-ink: color-mix(in oklab, var(--p-cyan) 45%, #0b1026);
}

/* dark — four pass raw; only blue needs lifting off midnight */
.dark .accent-blue {
  --accent-ink: color-mix(in oklab, var(--p-blue) 88%, #f2f4fb);
}
.dark .accent-magenta {
  --accent-ink: var(--p-magenta);
}
.dark .accent-pink {
  --accent-ink: var(--p-pink);
}
.dark .accent-lime {
  --accent-ink: var(--p-lime);
}
.dark .accent-cyan {
  --accent-ink: var(--p-cyan);
}
```

**Those percentages were starting values, not measurements.** P1 measured all
ten in Chromium against the built stylesheet. **All ten cleared 4.5:1 as
written; none were adjusted.** The measured ratios are recorded in the comment
block at the top of `globals.css`. Adjust only a colour that fails; never move
the other four to match.

- **`--accent-tint`** is the large-area wash sitting behind neutral text:
  `color-mix(in srgb, var(--accent) 14%, transparent)` light, `18%` dark.
  It cannot be a custom property. A custom property resolves its `var()`
  references where it is _declared_, so `--accent-tint` on `:root` bakes in
  `:root`'s accent and a subtree that rebinds `--accent` inherits the resolved
  blue. It lives in `@theme inline` instead, where the mix is emitted into the
  utility and resolves against the element using it. The percentage is a
  separate per-mode variable (`--tint-strength`), which inherits normally.
  **"Behind neutral text" is literal.** `--accent-ink` on `--accent-tint` is
  not a sanctioned pair: blue ink on blue tint measures 4.44:1 over
  `--background` and 3.97:1 over `--surface` in dark mode. Text on a tint is
  neutral; only non-text (icons, the card's fallback initial) may take the
  ink, against WCAG 1.4.11's 3:1.
- An accent bar that is a card's _only_ visible boundary would need 3:1. Keep the
  neutral `--border` on every card so the accent bar stays decorative and
  redundant, and the question never arises.

### D3. Accents carry no meaning

Colour is decoration. Nothing in the app may be identifiable _by_ its accent.
Status colours (have / substitute / missing), focus rings and destructive
actions are semantic, live outside the palette, and are never dealt.

### D4. Domain accent is removed — confirmed

`.domain-bar` and `.domain-kitchen` are deleted along with their four
`--accent-bar-*` / `--accent-kitchen-*` variables. Random accents and
domain-identity accents are the same CSS variable and cannot coexist.

Bar and Kitchen are distinguished by background treatment, type scale, density
and copy (P6). `restructure-plan.md` D10 already required the two sides to be
distinguishable in a greyscale screenshot, so removing the hue is not a
regression — it is that rule finally becoming load-bearing.

### D5. Assignment is by dealing, not hashing — confirmed

A hash-per-entity cannot guarantee either stated constraint. A dealer
guarantees both:

- **Equal dispersion** — deal from a bag holding all five, refill only when
  empty. Counts across any list differ by at most 1.
- **No neighbouring repeats** — a pick must differ from the last 3 dealt. A
  lookback of 3 covers 1-, 2- and 3-column grids, where a cell's neighbours are
  `i±1`, `i±2` and `i±3`.
- **Determinism** — seeded from the list itself (FNV-1a over the first key plus
  the length). Never `Math.random()` at render: `RecipeCard` is used inside both
  server and client components, and a hydration mismatch here would repaint the
  entire page.

Consequence, accepted: the same recipe can be cyan in matches and pink in the
catalog. Colour is positional, not an identity.

### D6. Application is by class, not by prop

The existing `--accent` rebinding trick (`restructure-plan.md` D6) is the whole
implementation. A wrapper element carries `.accent-<name>`, which rebinds
`--accent` for its subtree, and **every existing `bg-accent` / `text-accent` /
`border-accent` inside follows with no component change**.

Do not add a `color` or `accent` prop to `RecipeCard`, `EmptyState`,
`PantryPanel`, or anything else. If a phase finds itself threading colour
through props, the approach is wrong — stop and revert to this decision.

### D7. Image art direction is one frozen constant

Consistency across the catalog _is_ the visual upgrade. 173 images sharing one
lighting setup, one surface family and one palette read as art direction; 173
images that don't read as a content farm. A single frozen `STYLE` string is
appended to every prompt in both domains; only framing differs by side.
Changing `STYLE` means reshooting the whole catalog — treat it as a one-way
door.

### D8. No new runtime dependencies

`sharp` (P3) is a pipeline devDependency, never imported by the app. The
dealer, the tokens and the motion are hand-rolled. `next/font` and `next/og`
are already present.

### D9. Motion respects `prefers-reduced-motion`

`globals.css` already shortens rather than removes transitions globally. Any new
entrance animation must be `motion-safe:` prefixed so that rule applies.

---

## P1 — Palette & token foundation

Everything inherits this. Nothing else in the plan can start.

**Tasks**

1. Rewrite the token block in `src/app/globals.css`:
   - The five `--p-*` palette variables on `:root`, mode-independent.
   - Neutrals per D1 across `:root` / `@media (prefers-color-scheme: dark)` /
     `.dark` / `.light`, preserving the existing four-block ordering so the
     explicit toggle keeps winning over the media query.
   - `--accent-foreground: #05081a` in **both** modes (D2 — blue is why).
   - `--accent-ink` and `--accent-tint` per D2.
   - Default `--accent` to `var(--p-blue)` so an un-dealt subtree still renders.
2. Add `--color-accent-ink` and `--color-accent-tint` to the `@theme inline`
   block so `text-accent-ink` and `bg-accent-tint` become Tailwind utilities.
3. Delete `.domain-bar`, `.domain-kitchen` and the four `--accent-bar-*` /
   `--accent-kitchen-*` variables. Remove the wrapper class from
   `src/app/bar/layout.tsx` and `src/app/kitchen/layout.tsx`.
4. Re-pick the semantic status colours against `#0b1026`. The current
   `green-100 / green-950`, `amber-700 / amber-400` and `red-600 / red-400`
   pairs were chosen against warm stone and will read muddy on midnight. Define
   them as `--ok`, `--warn`, `--miss` plus `-tint` variants, so they stop being
   inline Tailwind palette classes scattered across four components.
5. Audit every existing `text-accent` and `border-accent` usage and move it to
   `text-accent-ink` / `border-accent-ink`, and every `bg-accent/10` wash to
   `bg-accent-tint`. The list is not exhaustive — grep for it. Sites: the
   header logo SVG, `NavLink`'s active underline, `EmptyState`'s glyph,
   `AlmostThereNudge`'s border and background, `RecipeCard`'s fallback-tile
   initial, `LastDomain`'s underline, `RecipesFilter`'s checked chip,
   `/ingredients/[slug]`'s related chips, and every card's
   `hover:border-accent`. `bg-accent` + `text-accent-foreground` fills are
   already correct and stay as they are.
6. Unrelated one-liner, do it here: retire `NEXT_PUBLIC_SITE_URL` and make the
   canonical origin a constant in `src/lib/site-url.ts`, branching on
   `NODE_ENV` so `next dev` still serves from localhost. Setting the env var in
   the dashboard would fix the symptom; the finding is that a canonical origin
   with no reviewer drifts. Preview deploys resolving to the production origin
   is intended — a preview should canonicalise to production.

**Acceptance criteria**

- `grep -rn "domain-bar\|domain-kitchen\|accent-bar\|accent-kitchen" src/`
  returns nothing.
- All ten `--accent-ink` values (5 colours × 2 modes) clear **4.5:1** against
  their mode's `--background`. All five accents clear **4.5:1** against
  `--accent-foreground`. Record the fifteen measured ratios as a comment block
  in `globals.css`.
- No **raw** accent (`--accent` / `--p-*`) appears as a `1px` border or as text
  anywhere in `src/`. `--accent-ink` is the sanctioned form for both, per D2;
  raw accents are fills only.
- Toggling light/dark produces no flash — `themeInitScript` still runs before
  first paint.
- `npm run build` clean, `npm run test` green, `npm run lint` clean.
- `/sitemap.xml` and `/robots.txt` emit `whatsinhouse.vercel.app`.

---

## P2 — The accent dealer

**Tasks**

1. Create `src/lib/theme/accents.ts` per Appendix A. Pure, dependency-free, no
   React import.
2. Add `.accent-blue` … `.accent-cyan` to `globals.css`. Each rebinds `--accent`
   to its `--p-*` value and sets that colour's `--accent-ink` (D2). Nothing else.
3. Apply the dealer at each list site. The wrapper element takes the class; no
   child component changes:

   | Surface                            | List key            | Wrapper element                     |
   | ---------------------------------- | ------------------- | ----------------------------------- |
   | `MatchesView` sections             | `m.slug`            | the `<li>` around each `RecipeCard` |
   | `/bar/recipes`, `/kitchen/recipes` | `r.slug`            | each grid `<li>`                    |
   | `/favorites`                       | `r.slug`            | each `<li>`                         |
   | `DomainSummaryCards`               | `domain`            | each `<Link>` card                  |
   | `StarterSuggestions` chips         | `String(s.id)`      | each chip `<li>`                    |
   | `PantryPanel` chips                | `String(it.id)`     | each chip                           |
   | `/shopping` rows                   | the ingredient name | each row                            |
   | "More like this"                   | `r.slug`            | each `<li>`                         |

   Deal **per rendered section**, not across the whole page: `MatchesView`'s
   three sections are visually separate blocks, and dealing across them would
   let a "Ready to make" card and a "Missing 1" card collide at the seam without
   the lookback noticing.

4. Single, neighbourless components (`AlmostThereNudge`, `HomeHero`,
   `EmptyState`, the recipe-detail header) use `accentFor(key)` instead —
   stable per key, no adjacency to satisfy.
5. Give each card a visible accent affordance now that colour exists: a 4px
   accent bar on the card's leading edge, and `--accent-tint` behind the pill
   backgrounds. Keep the neutral `--border` (D2).

**Acceptance criteria**

- Unit test in `tests/accents.test.ts`: for every list length 1…200,
  `dealAccents` returns counts whose max and min differ by ≤ 1, and no two
  entries within 3 positions share a colour. Assert all five colours appear by
  length 5.
- Determinism test: `dealAccents(keys)` called twice returns identical arrays;
  `accentFor(k)` is stable across calls.
- Zero hydration warnings in the console on `/`, `/bar`, `/bar/matches`,
  `/bar/recipes` and `/kitchen` with a 20-ingredient pantry.
- Visual check at 375px, 768px and 1280px: no two touching cards share a colour
  at any column count.
- `RecipeCard`, `EmptyState`, `PantryPanel` and `StarterSuggestions` have **no**
  new props (D6).

---

## P3 — Image pipeline: both domains, current model, correct aspect

**Tasks**

1. `scripts/pipeline/db.ts` — `loadRecipesMissingImages()` reads **both**
   `cocktail_recipes` and `food_recipes`, stamps `domain` on each row, and for
   food rows attaches up to three non-staple, non-garnish ingredient names for
   the prompt.
2. `scripts/pipeline/image.ts`:
   - Default `MODEL` to `gpt-image-2`. `gpt-image-1` is retired 2026-10-23.
   - Widen the `SIZE` enum and move its `.catch()` default to `1536x1024`. Cards
     are `aspect-3/2`; generating square means every image is crop-lottery.
   - Freeze one `STYLE` constant (D7) and one `FRAMING` record keyed by domain.
     Cocktail: straight-on eye-level, glass centred, dark stone bar top, deep
     low-key background. Food: 45° three-quarter, single plated portion centred,
     pale linen and light oak, bright airy background. Shared `STYLE`: 50mm at
     f/2.0, soft directional window light from camera left, one warm highlight
     with gentle falloff, muted warm-neutral palette, natural saturation,
     shallow depth of field, no text, no watermark, no logos, no hands, no
     people.
   - `buildPrompt()` branches on `recipe.domain`.
3. Convert PNG → WebP with `sharp` before upload. gpt-image PNGs run ~1.5 MB; a
   twelve-card grid of those is a real LCP cost. Store `.webp` and keep the
   existing `upsert: true` path so reruns replace cleanly.
4. Migration: add `recipes.image_blur` (`text`, nullable) holding a ~10px
   base64 WebP, so cards fade in rather than pop. Populate in the same pass.
5. Run `npm run pipeline:images` against production. Targets: the 13 food
   recipes and 5 cocktails currently missing images.

**Acceptance criteria**

- `select count(*) from recipes where is_published and image_url is null` = 0.
- Every stored image is `.webp`, 1536×1024, under 200 KB.
- Every published recipe has a non-null `image_blur`.
- Idempotence holds: a second run reports 0 recipes needing an image and
  performs no writes.
- Ten randomly sampled food images are recognisably the named dish, and share
  one visible lighting setup and background family with each other **and** with
  the existing cocktail set.
- `OPENAI_IMAGE_API_KEY` is read nowhere outside `scripts/pipeline/`.

---

## P4 — The reveal

The payoff screen currently has zero images and buries the headline number in
an uppercase grey section label.

**Tasks**

1. Migration: `match_recipes_detail` returns `image_url` and `image_blur`.
   Regenerate `src/types/database.ts`.
2. `MatchCard` passes both through to `RecipeCard`. The existing `undefined` vs
   `null` contract already handles this — no signature change.
3. Lead `/bar/matches` and `/kitchen/matches` with the ready count as display
   type, not a section header: a large **14**, then "things you can make right
   now", then the filter group.
4. `motion-safe:` staggered entrance on match cards, 40 ms apart, capped at the
   first 12 so a long list doesn't crawl.
5. Promote "Surprise me" from a bordered grey button to an accent-filled action
   beside the count.
6. Recipe detail: replace the `max-w-xs aspect-square` thumbnail with a
   full-width `aspect-3/2` hero above the title.

**Acceptance criteria**

- Every match card renders a photo; no published recipe falls back to the
  letter tile.
- LCP on `/bar/matches` with a 20-ingredient pantry is under 2.5 s on a
  simulated Fast 3G profile. Use `priority` on the first two cards only.
- The ready-to-make count is the largest text on the page.
- Under `prefers-reduced-motion: reduce`, cards appear with no stagger and no
  transform.
- No new client round trip — the count comes from the existing
  `match_recipes_detail` response already in memory.

---

## P5 — The unlock moment

**Tasks**

1. `addToPantry` currently toasts "Added bourbon to your pantry." Change it to
   name the consequence: "Added bourbon — that unlocks 6 cocktails." Compute by
   diffing the ready count before and after; fall back to the plain message on
   error. This is a flourish, not a required surface.
2. When an add moves exactly one recipe from missing-1 to ready, name that
   recipe instead: "Added lime juice — you can now make a Daiquiri."
3. Retire `text-red-600` / `text-red-400` on missing-ingredient lines in
   `MatchesView` and `RecipePantryStatus`; they use `--warn` (amber). Red is
   reserved for actual errors: the matches fetch failure and the auth form. A
   missing ingredient is an opportunity, not a fault.
4. Promote `buyNext()` from a green strip inside one section to a standing
   element at the top of matches, styled as an accent block.
5. Per-card progress: replace the "Missing 1" text badge with `5/6` plus a thin
   accent-filled bar. Keep the full missing-ingredient names in the badge's
   `title` and `aria-label` — the visual is additive, never a replacement.

**Acceptance criteria**

- Adding an ingredient that completes at least one recipe produces a toast
  naming either the recipe (when exactly one) or the count (when more).
- `grep -rn "text-red-" src/components src/app` returns only the two error
  surfaces.
- Screen-reader output for a match card still announces missing ingredients by
  name.
- Toast copy degrades silently to the current wording when the count call
  fails; no error is surfaced to the user.

---

## P6 — Typography and the two skins

With D4, Bar and Kitchen no longer differ by hue. This phase is what replaces
that, and it is also what removes the last of the template look.

**Tasks**

1. Add one display face via `next/font/google` for recipe names, page `h1`s and
   the wordmark. Geist for all text is the single loudest "this is a scaffold"
   signal in the app. **Pick one and commit** — Fraunces, Instrument Serif, or
   Bricolage Grotesque. Geist stays for UI, body and numerals.
2. Bar skin: tighter leading, denser card grid, heavier use of `--surface`,
   lower-key imagery. Kitchen skin: larger type scale, more whitespace, lighter
   cards, brighter imagery. Implement as two wrapper classes adjusting spacing
   and type-scale tokens only — **no colour**, and no per-domain component
   variants.
3. Break the universal `max-w-3xl` column. The recipe-detail hero and the
   catalog grids go full-bleed inside a wider container. Not every page should
   share one silhouette.
4. `/bar/recipes` and `/kitchen/recipes` become dense image grids rather than
   stacked lists.
5. Redo `src/app/opengraph-image.tsx` against the new palette — accent block,
   display face, recipe name.

**Acceptance criteria**

- A greyscale screenshot of `/bar` and one of `/kitchen` are distinguishable by
  layout and type alone.
- No page renders as an unbroken `max-w-3xl` stack from header to footer.
- CLS under 0.1 on `/recipes/[slug]` — the display font needs `display: swap`
  and a metric-compatible fallback.
- Total font payload under 100 KB.

---

## P7 — Kitchen catalog

13 dishes against 160 drinks means half the navigation is a stub. No amount of
visual work fixes that.

**Tasks**

1. Extend `scripts/pipeline/domains/food/` with an LLM generation path mirroring
   `domains/cocktail/generate.ts`. Food is curated-only via
   `src/data/food-seed.ts` today, and that ceiling is the constraint.
2. Grow the food-side ingredient taxonomy. 2 meats, 1 pasta and 2 legumes cannot
   match a real fridge. Target 120+ food-side ingredients, with `parent_id`
   hierarchies and `ingredient_derivations` populated the way the cocktail side
   already is.
3. Generate to 100+ published food recipes. Reuse the existing validator — it
   already fails runs on unresolved ingredients, duplicate slugs, missing
   licences and implausible times or servings.
4. Run P3's image pipeline over the new catalog.
5. Revisit `src/lib/pantry/lens.ts`. The README defers the derived Kitchen shelf
   until ~100 published food recipes; this phase crosses that line, so evaluate
   `docs/restructure-plan.md` Appendix B and either adopt it or record why not.
6. Delete the "Still being stocked" block from `/kitchen`.

**Acceptance criteria**

- ≥ 100 published food recipes, each with an image.
- A realistic 15-ingredient kitchen pantry (eggs, butter, onion, garlic, pasta,
  rice, canned tomatoes, olive oil, chicken, cheese, flour, lemon, stock, soy
  sauce, beans) returns **≥ 5 ready-to-make** dishes at `max_missing: 0`.
- `npm run pipeline:food -- --dry-run` passes with no unresolved ingredients.
- The lens decision is recorded in the README either way.

---

## P8 — Snap your shelf

The one feature someone shows a friend.

**Tasks**

1. Camera / file input → image → Claude vision → a _staged_ list of candidate
   ingredients matched against the catalog by name.
2. Staged, never auto-committed. The user reviews, deselects, and taps once to
   add. A wrong guess must cost nothing.
3. Degrade to the existing `IngredientSearch` on any failure, with no error
   surface beyond a toast.
4. Rate-limit per session. Route handler only; the key never reaches the client.
5. **This is a deliberate exception to "the AI never runs in the request path."**
   Document it in the README: user-initiated, non-blocking, and never on a
   matching or rendering path. The matcher stays deterministic SQL.

**Acceptance criteria**

- Matching stays pure SQL — no AI call in `match_recipes*`, `search_recipes`, or
  any page render.
- A photo of six bottles stages ≥ 4 correct ingredients and auto-adds none.
- The API key appears in no client bundle: `grep -r ANTHROPIC .next/static` is
  empty.
- With the route disabled, every other surface behaves exactly as before.

---

## Second wave — not scheduled, do not start early

Sequenced after P8 because each depends on the visual and payoff work landing
first.

- **"I made this"** → a date-stamped personal history, "you've made this 4
  times." The first thing in the app that accumulates.
- **Personal notes** per recipe ("Rittenhouse works better here").
- **The next bottle** — a full screen ranking every ingredient by how many
  recipes buying it would unlock. `buyNext()` already computes the top of this
  list, and it is the most novel thing the data supports.
- **Stats** — most-made, most-used ingredient, biggest unlock.
- **Year in review** — cheap to build, disproportionately shareable.
- **Copy pass** across all ~60 strings. Every one is currently correct and
  voiceless. "Nothing matches this filter" should not be the best line in the
  app.

---

## Appendix A — `src/lib/theme/accents.ts` (reference implementation)

```ts
export const ACCENTS = ["blue", "magenta", "pink", "lime", "cyan"] as const;
export type Accent = (typeof ACCENTS)[number];

/**
 * How many previously dealt colours a new pick must differ from. 3 covers 1-,
 * 2- and 3-column grids, where a cell's neighbours are i±1, i±2 and i±3.
 */
const LOOKBACK = 3;

/** FNV-1a. Stable across server and client — never Math.random() at render. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Seeded Fisher–Yates over the palette (mulberry32 PRNG). */
function shuffled(seed: number): Accent[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bag: Accent[] = [...ACCENTS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/**
 * Deal one accent per key. Guarantees, by construction:
 *  - counts across the list differ by at most 1 (equal dispersion)
 *  - no two entries within LOOKBACK positions share a colour
 *  - identical output for identical input, on server and client
 *
 * The bag holds all five and is refilled only once empty, which is what keeps
 * the counts even. The recent-window check is what makes bag boundaries safe —
 * within a single bag every colour is already distinct.
 */
export function dealAccents(keys: readonly string[]): Accent[] {
  const seed = hash(`${keys[0] ?? ""}:${keys.length}`);
  const out: Accent[] = [];
  let bag: Accent[] = [];
  let round = 0;

  for (let i = 0; i < keys.length; i++) {
    if (bag.length === 0) bag = shuffled(seed + round++);
    const recent = out.slice(-LOOKBACK);
    // With five colours and LOOKBACK 3 this never returns -1: a bag is only
    // refilled at full size, and remaining bag entries are by definition not
    // yet dealt from this bag. The fallback exists so a future palette or
    // lookback change degrades instead of throwing.
    let pick = bag.findIndex((a) => !recent.includes(a));
    if (pick === -1) pick = 0;
    out.push(bag[pick]);
    bag.splice(pick, 1);
  }
  return out;
}

/** For a lone component with no neighbours to avoid — stable per key. */
export function accentFor(key: string): Accent {
  return ACCENTS[hash(key) % ACCENTS.length];
}

/** The class that rebinds --accent for a subtree (D6). */
export function accentClass(accent: Accent): string {
  return `accent-${accent}`;
}
```

## Appendix B — measured contrast, for P1's acceptance check

Relative luminance and contrast ratios computed per WCAG 2.1. Reproduce these
before shipping P1, and record the resulting `--accent-ink` ratios beside them.

| Accent            | L      | vs white `#ffffff` | vs midnight `#0b1026` | vs ink `#05081a` |
| ----------------- | ------ | ------------------ | --------------------- | ---------------- |
| `#3772FF` blue    | 0.2007 | 4.19:1             | 4.49:1 ⚠              | **4.75:1**       |
| `#F038FF` magenta | 0.2858 | 3.13:1             | 6.02:1                | 6.36:1           |
| `#EF709D` pink    | 0.3238 | 2.81:1             | 6.70:1                | 7.08:1           |
| `#E2EF70` lime    | 0.7908 | **1.25:1**         | 15.06:1               | 15.92:1          |
| `#70E4EF` cyan    | 0.6516 | **1.50:1**         | 12.57:1               | 13.29:1          |

Three things to read out of this table:

1. **The right-hand columns are why the app is going midnight.** This palette
   was chosen for a dark background; it sings there and struggles on white.
2. **The white column is why D2 exists.** Lime and cyan are functionally
   invisible on white — accent-as-text on white is not a style choice to be
   made per component, it is a defect.
3. **Blue is the binding constraint in every direction.** It is the only colour
   that needs `--accent-ink` mixing in dark mode, and the only reason
   `--accent-foreground` is `#05081a` rather than `#0b1026`. Any future palette
   change gets checked against blue first.
