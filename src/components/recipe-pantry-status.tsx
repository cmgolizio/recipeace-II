"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePantry } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Database } from "../types/database";

/** A plain recipe ingredient row, fetched server-side by the detail page. */
export type IngredientRow = {
  ingredient_id: number;
  amount: number | null;
  unit: string | null;
  preparation: string | null;
  is_optional: boolean;
  display_order: number;
  name: string;
};

type StatusRow =
  Database["public"]["Functions"]["recipe_pantry_status"]["Returns"][number];

// Keyed to the pantry it was computed for, so loading/error/results are
// derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; statuses: StatusRow[] }
  | { key: string; error: string };

function StatusBadge({ row }: { row: StatusRow }) {
  if (row.status === "have") {
    return (
      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">
        ✓ in your bar
      </span>
    );
  }
  if (row.status === "substitute") {
    return (
      <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
        ↺ use {row.substitute_with}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-medium text-red-600/80 dark:text-red-400/80">
      ✗ missing
    </span>
  );
}

/**
 * Client island for the recipe detail page: renders the ingredient list from
 * server-fetched rows immediately, then overlays pantry-status badges and the
 * "you can make this" banner once recipe_pantry_status resolves. Badges sit in
 * the row's existing right-hand slot, so nothing shifts when they appear.
 */
export function RecipePantryStatus({
  recipeId,
  ingredients,
}: {
  recipeId: number;
  ingredients: IngredientRow[];
}) {
  const pantry = usePantry();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const pantryKey = [...pantry].sort((a, b) => a - b).join(",");
  const key = `${recipeId}::${pantryKey}`;

  useEffect(() => {
    if (pantryKey === "") return;
    let ignore = false;
    const ids = pantryKey.split(",").map(Number);
    const outcomeKey = `${recipeId}::${pantryKey}`;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("recipe_pantry_status", {
        p_recipe_id: recipeId,
        pantry: ids,
      });
      if (ignore) return;
      if (error) setOutcome({ key: outcomeKey, error: error.message });
      else setOutcome({ key: outcomeKey, statuses: data ?? [] });
    })();
    return () => {
      ignore = true;
    };
  }, [recipeId, pantryKey]);

  const hasPantry = pantry.length > 0;
  const current = outcome?.key === key ? outcome : null;
  const statuses =
    hasPantry && current && "statuses" in current ? current.statuses : null;
  const statusError =
    hasPantry && current && "error" in current ? current.error : null;

  const statusById = new Map(statuses?.map((s) => [s.ingredient_id, s]));
  const missingRequired = (statuses ?? []).filter(
    (s) => !s.is_optional && s.status === "missing",
  ).length;
  const substitutes = (statuses ?? []).filter(
    (s) => s.status === "substitute",
  ).length;

  return (
    <>
      {statuses !== null && (
        <p
          className={
            missingRequired === 0
              ? "rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
              : "rounded-lg bg-black/[0.06] px-3 py-2 text-sm font-medium dark:bg-white/10"
          }
        >
          {missingRequired === 0
            ? substitutes > 0
              ? `You can make this — with ${substitutes} substitution${substitutes > 1 ? "s" : ""}.`
              : "You can make this with what’s in your bar."
            : `Missing ${missingRequired} ingredient${missingRequired > 1 ? "s" : ""}.`}
        </p>
      )}
      {statusError !== null && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn’t check this against your bar: {statusError}
        </p>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Ingredients
        </h2>
        <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {ingredients.map((ri) => {
            const status = statusById.get(ri.ingredient_id);
            return (
              <li
                key={ri.ingredient_id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  {ri.amount != null && <span>{ri.amount} </span>}
                  {ri.unit && <span>{ri.unit} </span>}
                  <span className="font-medium">{ri.name}</span>
                  {ri.preparation && (
                    <span className="opacity-60">, {ri.preparation}</span>
                  )}
                  {ri.is_optional && (
                    <span className="opacity-50"> (optional)</span>
                  )}
                </span>
                {status && <StatusBadge row={status} />}
              </li>
            );
          })}
        </ul>
        {!hasPantry && (
          <p className="mt-3 text-sm opacity-60">
            <Link href="/" className="underline">
              Add ingredients to your bar
            </Link>{" "}
            to see what you have and what you’re missing.
          </p>
        )}
      </section>
    </>
  );
}