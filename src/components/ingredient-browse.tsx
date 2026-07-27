"use client";

import { useEffect, useState } from "react";

import { addToPantry, removeFromPantry, usePantry } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Tables } from "../types/database";

import { toast } from "./toast/store";

type Ingredient = Pick<
  Tables<"ingredients">,
  "id" | "name" | "category" | "is_staple"
>;

// Fixed display order. Staples are excluded from the browser entirely — they
// count as always on hand, so there is nothing to add.
const CATEGORY_ORDER: Ingredient["category"][] = [
  "spirit",
  "liqueur",
  "fortified_wine",
  "wine",
  "bitters",
  "mixer",
  "juice",
  "syrup",
  "dairy",
  "produce",
  "garnish",
  "other",
];

// The full ingredient list is small and world-readable; fetch it once and keep
// it across collapses and remounts.
let ingredientCache: Ingredient[] | null = null;

type BrowseState = { ingredients: Ingredient[] } | { error: string };

export function IngredientBrowse() {
  const pantry = usePantry();
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<BrowseState | null>(
    ingredientCache ? { ingredients: ingredientCache } : null,
  );

  useEffect(() => {
    if (!expanded || state !== null) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ingredients")
        .select("id,name,category,is_staple")
        .order("name");
      if (ignore) return;
      if (error) {
        setState({ error: error.message });
      } else {
        ingredientCache = data;
        setState({ ingredients: data });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [expanded, state]);

  const groups =
    state && "ingredients" in state
      ? CATEGORY_ORDER.map((category) => ({
          category,
          items: state.ingredients.filter(
            (it) => it.category === category && !it.is_staple,
          ),
        })).filter((g) => g.items.length > 0)
      : [];

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted hover:text-foreground"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        Browse ingredients
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {state === null && <p className="text-sm text-muted">Loading…</p>}
          {state && "error" in state && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Couldn’t load ingredients: {state.error}
            </p>
          )}
          {groups.map(({ category, items }) => (
            <details
              key={category}
              className="rounded-lg border border-border bg-surface"
            >
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium capitalize">
                {category.replace("_", " ")}{" "}
                <span className="opacity-50">({items.length})</span>
              </summary>
              <ul className="flex flex-wrap gap-2 px-4 pb-3">
                {items.map((it) => {
                  const inBar = pantry.includes(it.id);
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (inBar) {
                            removeFromPantry(it.id);
                            toast(`Removed ${it.name} from your bar`);
                          } else {
                            addToPantry(it.id);
                            toast(`Added ${it.name} to your bar`);
                          }
                        }}
                        aria-pressed={inBar}
                        className={
                          inBar
                            ? "inline-flex items-center gap-1.5 rounded-full border border-green-600/40 bg-green-50 px-3 py-1 text-sm text-green-700 dark:border-green-400/40 dark:bg-green-950/30 dark:text-green-400"
                            : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-black/4 dark:hover:bg-white/6"
                        }
                      >
                        {inBar && <span aria-hidden="true">✓</span>}
                        {it.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}