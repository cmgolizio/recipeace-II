"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePantry } from "../../lib/pantry/store";
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

// Keyed to the pantry it was computed for, so loading/error/results are derived
// during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; matches: Match[] }
  | { key: string; error: string };

function statusLabel(m: MatchRow): string {
  if (m.missing_count === 0) {
    return m.substitute_count > 0
      ? `Ready · ${m.substitute_count} substitution${m.substitute_count > 1 ? "s" : ""}`
      : "Ready to make";
  }
  return `Missing ${m.missing_count}`;
}

export default function MatchesPage() {
  const pantry = usePantry();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = [...pantry].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const ids = [...pantry];
      const { data: ranked, error: matchErr } = await supabase.rpc(
        "match_recipes",
        { pantry: ids },
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
  }, [key, pantry]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
        <p className="opacity-70">
          Ranked by how few ingredients you’re missing, from your bar of{" "}
          {pantry.length}.
        </p>
      </div>

      {loading && <p className="opacity-60">Mixing…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load matches: {error}
        </p>
      )}
      {!loading && !error && matches.length === 0 && (
        <p className="opacity-60">
          No recipes in the database yet. Run{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            supabase/seed_test_recipes.sql
          </code>{" "}
          to add some.
        </p>
      )}

      <ul className="space-y-3">
        {matches.map((m) => (
          <li
            key={m.recipe_id}
            className="rounded-xl border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">
                <Link
                  href={`/recipes/${m.recipe.slug}`}
                  className="hover:underline"
                >
                  {m.recipe.name}
                </Link>
              </h2>
              <span
                className={
                  m.missing_count === 0
                    ? "shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
                    : "shrink-0 rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-medium opacity-80 dark:bg-white/10"
                }
              >
                {statusLabel(m)}
              </span>
            </div>
            {(m.recipe.method || m.recipe.glass) && (
              <p className="mt-0.5 text-xs uppercase tracking-wide opacity-50">
                {[m.recipe.method, m.recipe.glass].filter(Boolean).join(" · ")}
              </p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {[...m.recipe.recipe_ingredients]
                .sort((a, b) => a.display_order - b.display_order)
                .map((ri, idx) => (
                  <li key={idx} className="opacity-80">
                    {ri.amount != null && <span>{ri.amount} </span>}
                    {ri.unit && <span>{ri.unit} </span>}
                    {ri.ingredients?.name ?? "—"}
                    {ri.is_optional && (
                      <span className="opacity-50"> (optional)</span>
                    )}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}