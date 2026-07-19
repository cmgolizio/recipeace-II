# Recipeace II — Claude Code Session Prompts

Run these in order. **Session 1 must complete before Session 3** (Session 3 consumes new RPC columns). **Session 5 should run after Session 2** (it edits pages Session 2 rewrites). Sessions 2 and 4 are independent.

Start each session fresh in the repo root. Paste one prompt per session.

---

## SESSION 1 — Database: derived ingredients, matcher fixes, missing-ingredient output

This is Recipeace II, a cocktail pantry-matching app (Next.js 16 + Supabase). The matcher lives in SQL: supabase/migrations/20260622120100_match_recipes.sql and 20260622120300_recipe_pantry_status.sql. Seed taxonomy is src/data/cocktail-seed.ts (~161 ingredients), compiled to SQL by scripts/generate-seed-sql.ts. Generated DB types are in src/types/database.ts.

Make the following database-layer changes. All schema changes go in NEW migration files (do not edit existing migrations). Since match_recipes changes its return signature, the new migration must `drop function` before recreating it.

### 1. Derived-ingredient relationships

Problem: a user with "orange (fruit)" in their bar is told they're missing "orange peel". Owning a whole ingredient should count as EXACTLY HAVING anything physically derivable from it.

- New table `public.ingredient_derivations (id, source_id, derived_id, created_at)` with FKs to ingredients (on delete cascade), a check constraint source_id <> derived_id, unique (source_id, derived_id), an index on derived_id, RLS enabled with a world-readable select policy (match the pattern used for ingredient_substitutions in 20260622120000_initial_schema.sql).
- Semantics: if source is in the pantry's exact set, every derived ingredient is ALSO in the exact set (status "have", not "substitute"). Direction is one-way: owning orange peel does NOT grant a whole orange.
- Update BOTH match_recipes and recipe_pantry_status: after the existing ancestor expansion (exact_pantry) and staples union, expand the exact set through derivations recursively (a derived item's own derivations/ancestors should also resolve — use a recursive CTE like the existing exact_pantry one; UNION not UNION ALL to terminate on cycles).
- In recipe_pantry_status, when an ingredient is satisfied only via derivation, keep status 'have' but populate a new output column `derived_from text` with the source ingredient's name (so the UI can render "✓ via orange (fruit)"). Null when directly owned/ancestor/staple.

### 2. Taxonomy audit for derivation pairs

Read every ingredient in src/data/cocktail-seed.ts and add a `derivations` seed section (mirror the existing substitutions section shape: name → name pairs). Update the SeedIngredient/seed types, generate-seed-sql.ts (insert pass resolving names to ids, same idempotent upsert style), and supabase/seed.sql via `npm run generate:seed`.

Find EVERY pair where owning A physically yields B. At minimum audit:

- Each whole citrus fruit (orange, lemon, lime, grapefruit, etc.) → its peel, twist, wedge, wheel, zest, and slice ingredients if they exist in the taxonomy.
- Each whole citrus fruit → its fresh juice (you can juice a lemon you own).
- Mint → mint sprig / mint leaves.
- Egg → egg white / egg yolk if present.
- Any other fruit → its garnish form (cherry variants, cucumber → cucumber slice, etc.).
  Do NOT derive syrups, cordials, or anything requiring real preparation beyond cutting/juicing (no sugar → simple syrup).
  In your final summary, list every derivation pair you added as "source → derived" so I can veto any.

### 3. match_recipes: stop returning zero-overlap recipes + return missing ingredients

- Add a hard filter: never return recipes where exact_count = 0 AND substitute_count = 0 (the user has literally nothing for it). Apply regardless of max_missing.
- Change the max_missing parameter default from null to 2, so unfiltered calls stop returning hopeless matches. Callers can still pass null explicitly for "show all with any overlap".
- Add an output column `missing_ingredients text[]` — the names of the required ingredients that are neither exact nor substitute-covered, ordered by display_order then name. (Aggregate from the classified CTE joined to ingredients.)

### 4. Regenerate types

Regenerate src/types/database.ts to include the new table, new function signatures, and new output columns (use `supabase gen types typescript --local` if a local instance is available; otherwise hand-write the diffs in the exact style of the existing file). The two client callers (src/app/matches/page.tsx, src/app/recipes/[slug]/page.tsx) must still typecheck — update their row types minimally if the new columns break them, but do NOT build new UI for the new data yet (that's a later session).

Verify: run the migrations against local Supabase if available, npm run lint, and a typecheck/build. Sanity-test with SQL: a pantry containing only the orange (fruit) id should make recipe_pantry_status report orange peel as 'have' with derived_from = 'orange (fruit)' (adjust names to actual seed names).

```

---

## SESSION 2 — Server rendering, metadata, images, route states, pagination

```

This is Recipeace II (Next.js 16 App Router + Supabase). Currently src/app/recipes/page.tsx and src/app/recipes/[slug]/page.tsx are fully client-rendered ("use client" + useEffect fetches), so there's no SEO, no per-page metadata, and first paint waits on a client round-trip. An unused server Supabase client already exists at src/lib/supabase/server.ts. Recipe data is public and world-readable via RLS.

### 1. Convert /recipes to a Server Component with pagination + server-side filtering

- Make src/app/recipes/page.tsx an async Server Component. Read `searchParams` for `q` (name/description filter, ilike) and `page`. Page size 24, ordered by name. Fetch with the server client using .range() for pagination and a head count query (or count: 'exact') for total pages.
- Keep the filter input as a small client component that updates the URL (router.replace with the q param, debounced ~300ms) so the RSC re-renders. Prev/Next pagination links (plain <Link> with searchParams) — only render pagination when there's more than one page.
- Preserve the existing card design and empty states (empty-DB copy gets replaced in a later session — leave as is).

### 2. Convert /recipes/[slug] to server-rendered with a client pantry island

- Server Component fetches the recipe header by slug with the server client; call notFound() when absent.
- Add generateMetadata: title `${recipe.name} — Recipeace`, description from recipe.description, and openGraph/twitter image from image_url when present.
- Extract the pantry-dependent parts (the recipe_pantry_status RPC call, the "You can make this" banner, ingredient status badges) into a client component, e.g. src/components/recipe-pantry-status.tsx, receiving recipeId as a prop. It keeps the existing outcome-keying pattern (see src/lib/pantry/store.ts usage). The static parts (image, header, instructions, garnish) render on the server. Note: the ingredient LIST itself depends on the RPC output today — restructure so the server renders the plain ingredient list from a direct recipe_ingredients select, and the client island only overlays status badges + the banner once pantry status loads (no layout shift when it resolves; reserve badge space or append inline).

### 3. next/image

- Both recipe images are eslint-disabled raw <img> tags. Add images.remotePatterns to next.config.mjs for the Supabase storage host (derive the hostname from NEXT_PUBLIC_SUPABASE_URL — hardcode the project host from .env.local if reading env in config is awkward, with a comment). Replace both <img> usages with next/image with proper sizes/fill or width/height, and remove the eslint-disable comments.

### 4. Route-level states

- src/app/recipes/loading.tsx: skeleton grid matching the card layout (pulse blocks, correct aspect ratio for the image area).
- src/app/recipes/[slug]/loading.tsx: skeleton for the detail layout.
- src/app/recipes/[slug]/not-found.tsx: friendly 404 with a link back to /recipes.
- A root src/app/error.tsx client component with a reset button, styled consistently with the existing design language (rounded-xl borders, opacity-based text).
- /matches stays client-rendered (it's pantry-dependent) — do not convert it.

Verify with npm run lint and npm run build. Confirm /recipes and a recipe detail page render HTML content with JS disabled conceptually (i.e., content is in the server payload), and that generateMetadata output appears in the built page head.

```

---

## SESSION 3 — Matches page intelligence (requires Session 1)

```

This is Recipeace II. The database now has: match_recipes returning missing_ingredients text[] and defaulting max_missing to 2, filtering out zero-overlap recipes; recipe_pantry_status returning derived_from. The matches page is src/app/matches/page.tsx (client-rendered, keyed-outcome pattern); the pantry store is src/lib/pantry/store.ts which already exports an unused usePantryReady() hook. Rebuild the matches experience:

### 1. Fix the pantry hydration flash

/matches renders "Your bar is empty" for a frame before localStorage hydrates, and the header count badge (src/components/site-header.tsx) flashes 0. Gate both on usePantryReady(): matches shows the loading state until ready; the header badge renders a neutral placeholder (or nothing) until ready.

### 2. Filter control

Add a segmented control above the results: "Ready now" (max_missing 0) / "Missing ≤ 1" / "Missing ≤ 2" (default). Pass the value through to the match_recipes RPC. Persist the selection in the URL (searchParams) so it survives refresh. Refetch on change using the existing outcome-key pattern (fold the filter value into the key).

### 3. Grouped results

Group the returned matches into sections rendered in order: "Ready to make" (missing_count 0), "Missing 1 ingredient", "Missing 2 ingredients". Section headers with counts. Keep the RPC's ordering within each group. Hide empty sections.

### 4. Show WHAT's missing on each card

Each card currently lists all ingredients uniformly and only says "Missing 2". Using missing_ingredients from the RPC:

- Render missing ingredient names visually distinct in the ingredient chips (e.g. red-tinted text, consistent with the existing red-600/dark:red-400 usage) and everything else at normal opacity.
- On the status pill for non-ready recipes, show "Missing: lime juice, gin" when it fits (truncate gracefully past ~2 names to "Missing 2: lime juice, +1").

### 5. "Buy this next" suggestion

Above the "Missing 1" section, compute from the current results: the single missing ingredient that appears in the most missing_count=1 recipes. Render a callout: "Add <ingredient> to unlock N more recipes" (only when N ≥ 2). If there's a tie, show the top one. Style it like a highlighted card consistent with the green "ready" pill palette.

### 6. Recipe detail: derivation labels

In the recipe detail pantry-status UI (the status badge component — it may now live in src/components/recipe-pantry-status.tsx if the RSC refactor session ran, otherwise in src/app/recipes/[slug]/page.tsx), when a 'have' row has derived_from set, render "✓ via {derived_from}" instead of plain "✓ in your bar".

Keep everything consistent with the existing minimal design (opacity-based grays, rounded-xl, no new dependencies). Verify with npm run lint and npm run build, and exercise the page against local Supabase if available.

```

---

## SESSION 4 — Bar-building UX (search combobox, category browse, small fixes)

```

This is Recipeace II. The home page (src/app/page.tsx) composes src/components/ingredient-search.tsx (debounced search over a search_ingredients RPC, keyed-state pattern) and src/components/pantry-panel.tsx. Improve how users build their bar:

### 1. Clear the search input after adding

In ingredient-search.tsx, when a result is clicked and it ADDS to the pantry (not when it removes), clear the query, close the results panel, and return focus to the input so the user can immediately type the next ingredient.

### 2. Proper combobox behavior

- Keyboard: ArrowDown/ArrowUp move an active-item highlight through results (wrapping), Enter adds/toggles the highlighted item (and clears per #1 on add), Escape closes the panel and clears highlight. Home/End optional.
- ARIA: role="combobox" with aria-expanded/aria-controls on the input, role="listbox" on the panel, role="option" + aria-selected on items, aria-activedescendant tracking the highlight. Visually indicate the highlighted row (same hover background class).
- Dismiss the panel on click/tap outside and on blur leaving the widget (careful not to close before an option click registers — use pointerdown on options or a small blur timeout).
- Result caching: keep a module-level or ref Map<string, SearchResult[]> keyed by search term so backspacing to a previously-fetched term renders instantly without refiring the RPC. Errors are not cached. Keep the existing 200ms debounce and keyed-state staleness handling.

### 3. Category browse

Search-only discovery hides the taxonomy from new users. Below the search box (above the pantry panel) add a collapsible "Browse ingredients" section:

- Fetch all ingredients (id, name, category, is_staple) once on expand (they're world-readable and small — one query, cache in component/module state).
- Group by category in a sensible fixed order (spirit, liqueur, fortified_wine, wine, bitters, mixer, juice, syrup, dairy, produce, garnish, other — exclude staples since they're always on hand; if shown, label them "always available" and non-interactive). Each category is a disclosure section with chip buttons; tapping a chip toggles it in/out of the bar with the same visual language as the pantry chips (green/checked state when in the bar).
- Collapsed by default; remember the expanded state in the component only (no persistence needed).

### 4. Pantry panel incremental fetch

pantry-panel.tsx currently re-fetches ALL ingredient details on every pantry change. Change it to only fetch ids missing from its cache (diff pantry against cached ids; skip the query entirely when there's nothing new). Keep the existing render-the-subset behavior.

No new dependencies; keep the existing minimal styling. Verify with npm run lint and npm run build, and manually exercise keyboard flow if a browser is available.

```

---

## SESSION 5 — Accounts & polish (favorites, auth, empty states, README, manifest) — run after Session 2

```

This is Recipeace II (Next.js 16 + Supabase; auth via @supabase/ssr with a proxy in src/proxy.ts refreshing sessions; pantry store in src/lib/pantry/store.ts reacts to onAuthStateChange). Final polish pass:

### 1. Favorites

- New migration: public.favorite_recipes (user_id uuid references auth.users on delete cascade, recipe_id bigint references recipes on delete cascade, created_at, PK (user_id, recipe_id)), index on recipe_id, RLS owner-only select/insert/delete — copy the exact policy style of pantry_items in 20260622120000_initial_schema.sql (auth.uid() wrapped in a sub-select). Regenerate/update src/types/database.ts.
- Client favorites store: extend the existing store pattern (or a sibling module in src/lib/) — signed-in only, loaded on auth, optimistic add/remove with rollback-via-refetch on error, mirroring how pantry_items writes work in store.ts. Anonymous users see a prompt to log in instead of a heart.
- UI: heart toggle on the recipe detail page (in the client pantry-status island if it exists) and a small heart indicator on recipe/match cards when favorited. New /favorites page listing favorited recipes (client-rendered is fine), linked from the site header for signed-in users.

### 2. Auth polish

- Forgot password: link on the login form → sends supabase.auth.resetPasswordForEmail with redirectTo pointing at a new /auth/reset page where the recovered session sets a new password via supabase.auth.updateUser. Handle the PASSWORD_RECOVERY auth event.
- Google OAuth: "Continue with Google" button on src/components/auth-form.tsx using signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } }), plus a route handler at src/app/auth/callback/route.ts exchanging the code via the server client (exchangeCodeForSession) and redirecting to /. Add a README note (see #4) that Google must be enabled in the Supabase dashboard with client ID/secret — that part is manual.
- The pantry-migration-on-signin logic in store.ts keys off onAuthStateChange, so OAuth sign-ins migrate the anonymous pantry automatically — verify by reading the code path, don't change it.

### 3. Production-appropriate empty states

/matches and /recipes currently tell end users to "run supabase/seed_test_recipes.sql". Replace with friendly copy ("No recipes yet — check back soon."). Keep the SQL hint only when process.env.NODE_ENV === 'development'.

### 4. README rewrite

Replace the default create-next-app README with real documentation: what the app is; architecture overview (offline AI pipeline writes to Postgres with canonical ingredient IDs, live app runs deterministic SQL — no AI in the request path); the matcher model (ancestor hierarchy, staples, derivations, one-hop bidirectional substitutions, ranking); anonymous-first pantry with migration on sign-in; local setup (supabase start, migrations, seed, env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY / OPENAI_TEXT_API_KEY); pipeline usage (npm run pipeline flags, pipeline:images); the Google OAuth dashboard setup note. Concise and factual — no marketing tone.

### 5. Web manifest + icons

Add src/app/manifest.ts (name Recipeace, standalone display, theme/background colors matching globals.css light/dark palette) and proper icon files (a simple cocktail-glass mark is fine — generate a clean SVG-derived PNG set: 192, 512, apple-touch). Wire icons via the app router metadata conventions.

Verify with npm run lint and npm run build. List any manual dashboard steps I need to do (Google provider config, redirect URLs) at the end of your summary.

```

---

## Notes

- After Session 1, apply migrations and re-seed before starting Session 3.
- Session 1's summary will list every derivation pair added — review it; the judgment calls are citrus → juice (included) and anything requiring prep (excluded).
- Sessions assume your existing AGENTS.md conventions load via CLAUDE.md, so surgical-change discipline is already in effect.
```
