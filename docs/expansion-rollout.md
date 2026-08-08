# Food Expansion — Rollout and Rollback

> **File:** `docs/expansion-rollout.md`
> **Covers:** plan §41 (phase 16 review) and §42 (phase 17 rollout).
>
> Everything in this document was prepared without access to a Supabase
> project — this repository has no `.env*` and no linked CLI. Schema work was
> verified against the real migrations in PGlite (`tests/db.ts`). **The steps
> below have not been run against production;** they are the procedure, and
> the checks a maintainer should perform while running it.

---

## 1. What ships

| Area           | Change                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Schema         | 9 migrations, `20260801120000` → `20260806120000` (the first may already be applied — see §9)         |
| Data           | `supabase/seed.sql` (regenerated: 4 ingredients re-categorised) and new `supabase/seed_food.sql`      |
| Routes         | `/bar`, `/bar/recipes`, `/bar/matches`, `/kitchen`, `/kitchen/recipes`, `/kitchen/matches`, `/search` |
| Redirects      | `/recipes` → `/bar/recipes`, `/matches` → `/bar/matches` (307)                                        |
| Brand          | Name unchanged ("In House Mixes"), now sourced from `src/lib/site.ts`; new fork-and-glass mark        |
| Service worker | `VERSION` bumped to `v2`, invalidating every `v1` cache                                               |

---

## 2. Migration order

Apply in filename order — they are dependent, and each assumes the last.

| Migration                                      | Does                                                                                        | Reversible?                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `20260801120000_recipe_domain`                 | `recipe_domain` enum, `recipes.domain` NOT NULL, index                                      | **Yes** — drop column and type. No data lost (backfill is derivable: everything was a cocktail).                                 |
| `20260801120100_domain_aware_recipe_queries`   | `ingredient_detail` +`p_domain`; `related_recipes` scoped                                   | **Yes** — re-run the previous definitions.                                                                                       |
| `20260801120200_match_recipes_domain`          | matcher `p_domain`; `_detail` returns domain + metadata                                     | **Yes** — re-run `20260702120100` / `20260721120000`.                                                                            |
| `20260802120000_recipe_detail_tables`          | detail tables, backfill, RLS, catalog views                                                 | **Yes** — drop views and tables. **The old columns on `recipes` are still populated**, so nothing is lost.                       |
| `20260802120100_functions_read_recipe_details` | three functions read the detail tables                                                      | **Yes** — re-run the previous definitions.                                                                                       |
| `20260803120000_food_ingredient_categories`    | 15 enum values                                                                              | **No** — Postgres cannot drop an enum value. Harmless: unused values cost nothing.                                               |
| `20260804120000_recipe_ingredients_food_ready` | drops the ingredient-uniqueness constraint, adds `section` and a line-uniqueness constraint | **Partly** — re-adding `unique (recipe_id, ingredient_id)` fails if any recipe has repeated an ingredient by then. Dedupe first. |
| `20260805120000_recipe_source_provenance`      | `recipes.source_url`, `recipes.license`                                                     | **Yes** — drop columns.                                                                                                          |
| `20260806120000_search_recipes`                | `search_recipes`                                                                            | **Yes** — drop function.                                                                                                         |

**No migration is destructive of existing data.** Nothing is dropped except
one constraint and one redundant index (`recipes_domain_idx`, superseded by
`recipes_domain_published_idx`). The deprecated cocktail columns on `recipes`
are deliberately left in place — see §6.

---

## 3. Deploy sequence

1. **Back up production.** Supabase dashboard → Database → Backups, or
   `pg_dump`. Do this even though nothing here is destructive.
2. **Run the migrations** in order. The first one asserts its own backfill and
   raises rather than leaving a row unclassified.
3. **Re-apply the ingredient seed** (`supabase/seed.sql`). It upserts on name,
   so ids and slugs are preserved; the only change is four categories
   (`whole egg`, `egg white` → `egg`; `fresh mint`, `fresh basil` → `herb`).
4. **Apply the food catalog** (`supabase/seed_food.sql`). It refuses to run if
   any of its slugs is already taken by a recipe in another domain.
5. **Deploy the application.** Backend and frontend ship together — the
   catalog views and the new function signatures are prerequisites of the
   query layer.
6. **Smoke test** (§4).
7. **Watch** Sentry and Vercel logs for the first hour, and the matcher's
   latency in particular (§5).

Steps 2–4 are idempotent: re-running any of them changes nothing.

---

## 4. Smoke tests

Cocktail behaviour first — the expansion is not a success if the Bar moved.

- [ ] `/recipes` 307s to `/bar/recipes`, query string preserved.
- [ ] `/matches?missing=1` 307s to `/bar/matches?missing=1`.
- [ ] `/bar/recipes` lists the same catalog as before, and the method, glass,
      spirit, flavour and difficulty filters all still narrow it.
- [ ] `/bar/matches` with a stocked pantry ranks identically to before.
- [ ] A cocktail detail page shows method, glass, garnish, ABV and flavour
      tags, and its pantry status hydrates.
- [ ] Favorites and the shopping list still hold what they held. A shopping
      list saved before the deploy survives the `v1` → `v2` migration.
- [ ] `/kitchen` shows the recipe count; `/kitchen/recipes` filters by course,
      cuisine, time and difficulty; `/kitchen/matches` ranks food.
- [ ] `/search?q=lime` returns both a drink and a dish.
- [ ] `/recipes/<a food slug>` renders times, servings, course and cuisine, and
      its source and licence.
- [ ] Signing in still migrates an anonymous pantry.
- [ ] The staple note appears under both matches pages.

---

## 5. Monitoring

- **Sentry** — client, server and edge, already wired. Watch for
  `Couldn't load…` throws from the recipe and ingredient loaders.
- **Matcher latency** — `match_recipes_detail` is the heaviest request-path
  query. Measured locally at **3.5 ms** against 23 recipes / 204 ingredients /
  149 lines (PGlite, warm). Treat anything above ~150 ms in production as a
  signal to add the indexes in §7.
- **Analytics** — `domain_switched`, `search_submitted` and
  `shopping_ingredients_added` carry a `domain` property; a Kitchen that never
  appears in them means nobody found it.

---

## 6. Rollback levers

Coarsest first. Each is independent.

| Need                             | Lever                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hide the Kitchen entirely        | `update public.recipes set is_published = false where domain = 'food';` — the catalog, matches, search and the Kitchen overview all empty out and the overview reverts to "still being stocked". No deploy needed. |
| Hide one bad food recipe         | Same, `where slug = '…'`.                                                                                                                                                                                          |
| Restore the old cocktail URLs    | The redirects are **307, not 308** — deliberately, so no browser has cached them permanently. Remove the `redirects()` block and move the two page files back.                                                     |
| Restore previous query behaviour | Re-run the pre-expansion definitions of `match_recipes`, `match_recipes_detail`, `related_recipes`, `ingredient_detail` from git history; the application would need reverting too, since the projections changed. |
| Undo the schema                  | §2's reversibility column. Drop in reverse order.                                                                                                                                                                  |
| Change the product name          | One line: `SITE_NAME` in `src/lib/site.ts` (plus the README heading). Nothing else hardcodes it.                                                                                                                   |
| Revert the mark                  | `src/app/icon.svg`, the inline SVG in `site-header.tsx`, and the one in `opengraph-image.tsx` — same three paths in each.                                                                                          |

**Failed pipeline inserts** leave no partial recipes: the food adapter
validates the whole catalog and writes _nothing_ unless every recipe passes,
and the SQL it emits runs in one transaction. To find anything half-applied
anyway:

```sql
-- Food recipes with no detail row, or no ingredient lines.
select r.slug
from public.recipes r
left join public.food_recipe_details d on d.recipe_id = r.id
where r.domain = 'food'
  and (d.recipe_id is null
       or not exists (select 1 from public.recipe_ingredients ri
                      where ri.recipe_id = r.id));
```

---

## 7. Known limits, and when they start to matter

None of these is a problem at the current catalog size (23 recipes). Each has
a stated trigger.

| Limit                                                                                                        | Bites at                  | Fix                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Both matches pages fetch **all** matches in one request, unpaginated                                         | a few hundred recipes     | paginate the RPC, or cap `max_missing` server-side                           |
| Both catalogs run a **second, unpaginated facet query** over every published row of their domain per request | ~1,000 recipes per domain | a facet RPC returning `distinct` values, or a materialised view              |
| `generateStaticParams` prerenders **every** recipe and ingredient (204 ingredients today)                    | build time you notice     | prerender the top N and let the rest render on demand                        |
| `search_recipes` matches `description` with `ilike '%…%'` and no index on that column                        | ~10,000 recipes           | a trigram index on `description`, or a `tsvector` column                     |
| No indexes on `food_recipe_details.course` / `.cuisine`                                                      | ~5,000 food recipes       | btree on each                                                                |
| A `%` or `_` typed into search behaves as a wildcard                                                         | never, functionally       | escape the pattern if it ever confuses anyone                                |
| Recipe cards are `<a>` elements containing buttons (favourite, add-to-list)                                  | already imperfect a11y    | pre-existing; restructure the card so the link is a sibling, not an ancestor |
| The shopping list is localStorage-only, not synced to the account                                            | multi-device users        | the follow-up the store's header comment already names                       |

---

## 8. Cleanup, after a stability period

Deliberately **not** part of this rollout (plan §23: remove obsolete
structures only after no code depends on them, and only once production has
confirmed it).

`recipes.method`, `glass`, `garnish`, `strength`, `base_spirit` and
`flavor_tags` are marked `DEPRECATED` in `comment on column`, are no longer
read or written by any code, and are fully mirrored in
`cocktail_recipe_details`. Once a release has run without incident:

```sql
-- Verify first: every cocktail's detail row matches the deprecated columns.
select count(*) from public.recipes r
join public.cocktail_recipe_details d on d.recipe_id = r.id
where r.domain = 'cocktail'
  and (r.method is distinct from d.method
    or r.glass is distinct from d.glass
    or r.garnish is distinct from d.garnish
    or r.strength is distinct from d.strength
    or r.base_spirit is distinct from d.base_spirit
    or r.flavor_tags is distinct from d.flavor_tags);
-- Expect 0. Then, in a migration of its own:
-- alter table public.recipes
--   drop column method, drop column glass, drop column garnish,
--   drop column strength, drop column base_spirit, drop column flavor_tags;
-- drop index if exists recipes_flavor_tags_idx;
-- drop index if exists recipes_base_spirit_idx;
```

`supabase/seed_test_recipes.sql` also writes those columns and would need
updating in the same change.

---

## 9. Runbook: applying this to a hosted project

The repository has no linked Supabase CLI, so migrations go in through the SQL
Editor by hand. `main` is also several commits behind this branch, so **what a
given project still needs depends on the project, not on the branch.**

### 9.1 Ask the database what it has

Run `supabase/migration-status.sql` in the SQL Editor. It is read-only and
returns one row per migration with an `applied` flag. Apply every file marked
`false`, in the `step` order it gives.

### 9.2 Apply them

Open each file under `supabase/migrations/`, paste, **Run**. One file per Run.

> **This ordering is not optional.** `20260803120000` adds enum values, and
> Postgres forbids _using_ a new enum value in the transaction that adds it.
> Each SQL Editor Run is one transaction, so as long as that file is its own
> Run — and the two seeds below are separate Runs after it — you are fine.
> Pasting it together with `seed.sql` fails with
> `unsafe use of new value "egg" of enum type ingredient_category`.

### 9.3 Re-apply the ingredient seed

Paste `supabase/seed.sql`, Run. It upserts on ingredient name, so ids and
slugs are preserved and nothing is deleted. The only change to existing rows
is four categories: `whole egg` and `egg white` → `egg`, `fresh mint` and
`fresh basil` → `herb`. **Must come after `20260803120000`** — those two
category values do not exist before it.

### 9.4 Apply the food catalog

Paste `supabase/seed_food.sql`, Run. It adds 44 ingredients, 20 aliases and 13
published food recipes, and it refuses to run if any of its slugs already
belongs to a recipe in another domain. Idempotent: running it twice changes
nothing.

**Do not run `supabase/seed_test_recipes.sql` against a project with real
recipes** — it is local development data (10 stub cocktails).

### 9.5 Nothing to run in the terminal

The generated SQL is committed, so no pipeline run is required to ship this.
The pipelines are only needed when the _source_ changes:

| You changed                 | Then run                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `src/data/cocktail-seed.ts` | `npm run generate:seed`, then paste `supabase/seed.sql`      |
| `src/data/food-seed.ts`     | `npm run pipeline:food`, then paste `supabase/seed_food.sql` |
| nothing                     | nothing                                                      |

`npm run pipeline` (cocktail generation) and `npm run pipeline:enrich` are
unchanged in how they are invoked, and both now write to
`cocktail_recipe_details`. `npm run pipeline:images` reads the
`cocktail_recipes` view, so it only ever fetches images for drinks — food
recipes render the branded initial tile until an image path for them exists.

### 9.6 Deploy

No new environment variables. Deploy the branch as usual.

The service worker's `VERSION` is bumped to `v2`, so returning visitors drop
every `v1` cache on their next load — no action needed, but it is why the
first load after deploy re-fetches the shell.

### 9.7 Verify the data landed

```sql
-- 13 food recipes, each with a detail row and a licence.
select count(*) as food_recipes,
       count(*) filter (where d.recipe_id is not null) as with_details,
       count(*) filter (where r.license is not null) as with_licence
from public.recipes r
left join public.food_recipe_details d on d.recipe_id = r.id
where r.domain = 'food';

-- Every cocktail carries its drink metadata in the new table.
select count(*) as cocktails,
       count(d.recipe_id) as with_details
from public.recipes r
left join public.cocktail_recipe_details d on d.recipe_id = r.id
where r.domain = 'cocktail';

-- Search reaches both domains.
select domain, count(*) from public.search_recipes('lime') group by domain;
```

Expect 13/13/13, cocktails = with_details, and both domains in the last one.
Then walk §4.
