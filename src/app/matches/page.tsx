"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { RecipeCard } from "../../components/recipe-card";
import { usePantry, usePantryReady } from "../../lib/pantry/store";
import { createClient } from "../../lib/supabase/client";
import type { Database } from "../../types/database";

type MatchRow =
  Database["public"]["Functions"]["match_recipes"]["Returns"][number];

type RecipeIngredient = {
  amount: number | null;
  unit: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  display_order: number;
  ingredients: { name: string } | null;
};

type RecipeDetail = {
  id: number;
  slug: string;
  name: string;
  method: string | null;
  glass: string | null;
  recipe_ingredients: RecipeIngredient[];
};

type Match = MatchRow & { recipe: RecipeDetail };

// Keyed to the pantry + filter it was computed for, so loading/error/results
// are derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; matches: Match[] }
  | { key: string; error: string };

type MaxMissing = 0 | 1 | 2;

const FILTERS: { value: MaxMissing; label: string }[] = [
  { value: 0, label: "Ready now" },
  { value: 1, label: "Missing ≤ 1" },
  { value: 2, label: "Missing ≤ 2" },
];

const SECTIONS: { missing: number; title: string }[] = [
  { missing: 0, title: "Ready to make" },
  { missing: 1, title: "Missing 1 ingredient" },
  { missing: 2, title: "Missing 2 ingredients" },
];

function parseMaxMissing(raw: string | null): MaxMissing {
  return raw === "0" ? 0 : raw === "1" ? 1 : 2;
}

function statusLabel(m: MatchRow): string {
  if (m.missing_count === 0) {
    return m.substitute_count > 0
      ? `Ready · ${m.substitute_count} substitution${m.substitute_count > 1 ? "s" : ""}`
      : "Ready to make";
  }
  const names = m.missing_ingredients;
  if (names.length === 0) return `Missing ${m.missing_count}`;
  if (names.length <= 2) return `Missing: ${names.join(", ")}`;
  return `Missing ${m.missing_count}: ${names[0]}, +${names.length - 1}`;
}

/**
 * The single missing ingredient that appears in the most missing_count=1
 * matches — buying it unlocks all of them. Ties keep the first in match
 * order; null when nothing would unlock at least 2 recipes.
 */
function buyNext(matches: Match[]): { name: string; unlocks: number } | null {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.missing_count !== 1) continue;
    const name = m.missing_ingredients[0];
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: { name: string; unlocks: number } | null = null;
  for (const [name, unlocks] of counts) {
    if (!best || unlocks > best.unlocks) best = { name, unlocks };
  }
  return best !== null && best.unlocks >= 2 ? best : null;
}

function MatchCard({ match: m }: { match: Match }) {
  const missing = new Set(m.missing_ingredients);
  return (
    <li>
      <RecipeCard
        recipe={m.recipe}
        titleAs="h3"
        badge={
          <span
            className={
              m.missing_count === 0
                ? "shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                : "shrink-0 rounded-full bg-black/6 px-2.5 py-0.5 text-xs font-medium opacity-80 dark:bg-white/10"
            }
          >
            {statusLabel(m)}
          </span>
        }
      >
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[...m.recipe.recipe_ingredients]
            .sort((a, b) => a.display_order - b.display_order)
            .map((ri, idx) => (
              <li
                key={idx}
                className={
                  ri.ingredients && missing.has(ri.ingredients.name)
                    ? "text-red-600 dark:text-red-400"
                    : "opacity-80"
                }
              >
                {ri.amount != null && <span>{ri.amount} </span>}
                {ri.unit && <span>{ri.unit} </span>}
                {ri.ingredients?.name ?? "—"}
                {ri.is_optional && (
                  <span className="opacity-50"> (optional)</span>
                )}
              </li>
            ))}
        </ul>
      </RecipeCard>
    </li>
  );
}

function MatchesLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
      <p className="opacity-60">Mixing…</p>
    </div>
  );
}

function MatchesContent() {
  const pantry = usePantry();
  const ready = usePantryReady();
  const router = useRouter();
  const searchParams = useSearchParams();
  const maxMissing = parseMaxMissing(searchParams.get("missing"));
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = `${maxMissing}:${[...pantry].sort((a, b) => a - b).join(",")}`;

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const ids = [...pantry];
      const { data: ranked, error: matchErr } = await supabase.rpc(
        "match_recipes",
        { pantry: ids, max_missing: maxMissing },
      );
      if (ignore) return;
      if (matchErr) {
        setOutcome({ key, error: matchErr.message });
        return;
      }
      const recipeIds = (ranked ?? []).map((r) => r.recipe_id);
      if (recipeIds.length === 0) {
        setOutcome({ key, matches: [] });
        return;
      }
      const { data: recipes, error: recipeErr } = await supabase
        .from("recipes")
        .select(
          "id,slug,name,method,glass,recipe_ingredients(amount,unit,is_optional,is_garnish,display_order,ingredients(name))",
        )
        .in("id", recipeIds);
      if (ignore) return;
      if (recipeErr) {
        setOutcome({ key, error: recipeErr.message });
        return;
      }
      const byId = new Map(
        ((recipes ?? []) as unknown as RecipeDetail[]).map((r) => [r.id, r]),
      );
      // Preserve the RPC ranking (fewest missing, then fewest substitutions).
      const matches = (ranked ?? [])
        .map((m): Match | null => {
          const recipe = byId.get(m.recipe_id);
          return recipe ? { ...m, recipe } : null;
        })
        .filter((m): m is Match => m !== null);
      setOutcome({ key, matches });
    })();
    return () => {
      ignore = true;
    };
  }, [key, pantry, maxMissing]);

  // Wait for localStorage/auth hydration before deciding the bar is empty.
  if (!ready) return <MatchesLoading />;

  if (pantry.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
        <p className="opacity-70">
          Your bar is empty.{" "}
          <Link href="/" className="underline">
            Add some ingredients
          </Link>{" "}
          to see what you can make.
        </p>
      </div>
    );
  }

  const current = outcome?.key === key ? outcome : null;
  const loading = current === null;
  const error = current && "error" in current ? current.error : null;
  const matches = current && "matches" in current ? current.matches : [];
  const suggestion = buyNext(matches);
  const sections = SECTIONS.map((s) => ({
    ...s,
    items: matches.filter((m) => m.missing_count === s.missing),
  }));

  function selectFilter(value: MaxMissing) {
    // 2 is the default, so keep the URL clean for it.
    router.replace(value === 2 ? "/matches" : `/matches?missing=${value}`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
        <p className="opacity-70">
          Ranked by how few ingredients you’re missing, from your bar of{" "}
          {pantry.length}.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter by how many ingredients are missing"
        className="inline-flex rounded-lg border border-black/10 p-0.5 text-sm dark:border-white/15"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={maxMissing === f.value}
            onClick={() => selectFilter(f.value)}
            className={
              maxMissing === f.value
                ? "rounded-md bg-black/6 px-3 py-1 font-medium dark:bg-white/10"
                : "rounded-md px-3 py-1 opacity-60 hover:opacity-100"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="opacity-60">Mixing…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load matches: {error}
        </p>
      )}
      {!loading &&
        !error &&
        matches.length === 0 &&
        (maxMissing < 2 ? (
          <p className="opacity-60">
            Nothing matches this filter — try allowing more missing
            ingredients.
          </p>
        ) : (
          <p className="opacity-60">
            No recipes yet — check back soon.
            {process.env.NODE_ENV === "development" && (
              <>
                {" "}
                Run{" "}
                <code className="rounded bg-black/6 px-1 dark:bg-white/10">
                  supabase/seed_test_recipes.sql
                </code>{" "}
                to add some.
              </>
            )}
          </p>
        ))}

      {sections.map((s) =>
        s.items.length === 0 ? null : (
          <section key={s.missing} className="space-y-3">
            {s.missing === 1 && suggestion && (
              <div className="rounded-xl bg-green-100 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
                Add <span className="font-semibold">{suggestion.name}</span> to
                unlock {suggestion.unlocks} more recipes.
              </div>
            )}
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              {s.title} · {s.items.length}
            </h2>
            <ul className="space-y-3">
              {s.items.map((m) => (
                <MatchCard key={m.recipe_id} match={m} />
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

export default function MatchesPage() {
  // useSearchParams needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<MatchesLoading />}>
      <MatchesContent />
    </Suspense>
  );
}