"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { RecipeCard } from "../../components/recipe-card";
import { usePantry, usePantryReady } from "../../lib/pantry/store";
import { addToShopping, useShopping } from "../../lib/shopping/store";
import { createClient } from "../../lib/supabase/client";
import type { Database } from "../../types/database";

type Match =
  Database["public"]["Functions"]["match_recipes_detail"]["Returns"][number];

/** Shape of each element in the RPC's `ingredients` jsonb array. */
type MatchIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
  is_optional: boolean;
};

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

function statusLabel(m: Match): string {
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

function AddMissingButton({ names }: { names: string[] }) {
  const shopping = useShopping();
  const remaining = names.filter((n) => !shopping.includes(n));
  if (remaining.length === 0) {
    return (
      <p className="mt-3 text-xs font-medium text-green-700 dark:text-green-400">
        ✓ On your shopping list
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        // The card is a Link — add without navigating.
        e.preventDefault();
        e.stopPropagation();
        for (const n of remaining) addToShopping(n);
      }}
      className="mt-3 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-black/4 dark:hover:bg-white/6"
    >
      + Add missing to shopping list
    </button>
  );
}

function MatchCard({ match: m }: { match: Match }) {
  const missing = new Set(m.missing_ingredients);
  const ingredients = m.ingredients as unknown as MatchIngredient[];
  return (
    <li>
      <RecipeCard
        recipe={{
          id: m.recipe_id,
          slug: m.slug,
          name: m.name,
          method: m.method,
          glass: m.glass,
        }}
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
          {ingredients.map((ing, idx) => (
            <li
              key={idx}
              className={
                missing.has(ing.name)
                  ? "text-red-600 dark:text-red-400"
                  : "opacity-80"
              }
            >
              {ing.amount != null && <span>{ing.amount} </span>}
              {ing.unit && <span>{ing.unit} </span>}
              {ing.name}
              {ing.is_optional && <span className="opacity-50"> (optional)</span>}
            </li>
          ))}
        </ul>
        {m.missing_count > 0 && (
          <AddMissingButton names={m.missing_ingredients} />
        )}
      </RecipeCard>
    </li>
  );
}

function MatchesLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
      <p className="text-muted">Mixing…</p>
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
      // One round trip: ranked matches with card fields and ingredients.
      const { data, error } = await supabase.rpc("match_recipes_detail", {
        pantry: [...pantry],
        max_missing: maxMissing,
      });
      if (ignore) return;
      if (error) setOutcome({ key, error: error.message });
      else setOutcome({ key, matches: data ?? [] });
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
        <p className="text-muted">
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
  const readyToMake = matches.filter((m) => m.missing_count === 0);
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

  function surpriseMe() {
    const pick = readyToMake[Math.floor(Math.random() * readyToMake.length)];
    if (pick) router.push(`/recipes/${pick.slug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
        <p className="text-muted">
          Ranked by how few ingredients you’re missing, from your bar of{" "}
          {pantry.length}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filter by how many ingredients are missing"
          className="inline-flex rounded-lg border border-border p-0.5 text-sm"
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
                  : "rounded-md px-3 py-1 text-muted hover:text-foreground"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={surpriseMe}
          disabled={readyToMake.length === 0}
          title={
            readyToMake.length === 0
              ? "Nothing is ready to make yet"
              : "Open a random recipe you can make right now"
          }
          className="rounded-lg border border-border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-black/4 dark:enabled:hover:bg-white/6"
        >
          Surprise me
        </button>
      </div>

      {loading && <p className="text-muted">Mixing…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load matches: {error}
        </p>
      )}
      {!loading &&
        !error &&
        matches.length === 0 &&
        (maxMissing < 2 ? (
          <p className="text-muted">
            Nothing matches this filter — try allowing more missing
            ingredients.
          </p>
        ) : (
          <p className="text-muted">
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
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