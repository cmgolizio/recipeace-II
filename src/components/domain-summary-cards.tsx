"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { splitByLens, type IngredientCategory } from "../lib/pantry/lens";
import { usePantry, usePantryReady } from "../lib/pantry/store";
import {
  DOMAIN_BLURB,
  DOMAIN_ROUTES,
  DOMAIN_SURFACE,
  RECIPE_DOMAINS,
  type RecipeDomain,
} from "../lib/recipes/domain";
import { createClient } from "../lib/supabase/client";

import { Skeleton } from "./skeleton";

type Counts = { ingredients: number; ready: number };

// Keyed to the pantry the counts were computed for, so a stale response never
// renders against a changed pantry (the pattern almost-there-nudge.tsx uses).
// `counts: null` is the degraded state — the cards are still the way into each
// side, so a failed count must never take them away.
type Outcome = { key: string; counts: Record<RecipeDomain, Counts> | null };

const cardClass =
  "block rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent";

/**
 * The chooser: two cards, Bar and Kitchen, each with what this pantry holds for
 * that side. `ingredients` is the domain's own shelf through the lens, `ready`
 * is what matches with nothing missing — one shared store, counted twice, which
 * is the whole story the split is meant to tell.
 */
export function DomainSummaryCards() {
  const pantry = usePantry();
  const ready = usePantryReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = [...pantry].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const ids = [...pantry];
      // Three round trips, one wait: the categories place each ingredient on a
      // shelf, and each domain's matcher call counts what is ready there.
      const [ingredients, cocktail, food] = await Promise.all([
        supabase.from("ingredients").select("id,category").in("id", ids),
        supabase.rpc("match_recipes_detail", {
          pantry: ids,
          max_missing: 0,
          p_domain: "cocktail",
        }),
        supabase.rpc("match_recipes_detail", {
          pantry: ids,
          max_missing: 0,
          p_domain: "food",
        }),
      ]);
      if (ignore) return;
      if (ingredients.error || cocktail.error || food.error) {
        setOutcome({ key, counts: null });
        return;
      }
      const items: { category: IngredientCategory }[] = ingredients.data ?? [];
      setOutcome({
        key,
        counts: {
          cocktail: {
            ingredients: splitByLens(items, "cocktail").mine.length,
            ready: (cocktail.data ?? []).length,
          },
          food: {
            ingredients: splitByLens(items, "food").mine.length,
            ready: (food.data ?? []).length,
          },
        },
      });
    })();
    return () => {
      ignore = true;
    };
  }, [key, pantry]);

  const current = outcome?.key === key ? outcome : null;
  // Only once the pantry is known and stocked is there anything to count, so
  // an empty pantry shows plain cards rather than a row of zeroes.
  const loading = ready && pantry.length > 0 && current === null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {RECIPE_DOMAINS.map((domain) => {
        const counts = current?.counts?.[domain];
        return (
          <Link
            key={domain}
            href={DOMAIN_ROUTES[domain].home}
            className={cardClass}
          >
            <h2 className="font-semibold">The {DOMAIN_SURFACE[domain]}</h2>
            <p className="mt-1 text-sm text-muted">{DOMAIN_BLURB[domain]}</p>
            {loading && <Skeleton className="mt-3 h-5 w-40" />}
            {counts && (
              <p className="mt-3 text-sm tabular-nums">
                <span className="font-semibold">{counts.ingredients}</span>{" "}
                ingredient{counts.ingredients === 1 ? "" : "s"} ·{" "}
                <span className="font-semibold">{counts.ready}</span> ready
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}