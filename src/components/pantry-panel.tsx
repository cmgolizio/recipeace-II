"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { splitByLens } from "../lib/pantry/lens";
import {
  clearPantry,
  removeFromPantry,
  usePantry,
  usePantryReady,
} from "../lib/pantry/store";
import {
  DOMAIN_MATCH_CTA,
  DOMAIN_ROUTES,
  DOMAIN_SHELF,
  DOMAIN_SURFACE,
  otherDomain,
  type RecipeDomain,
} from "../lib/recipes/domain";
import { createClient } from "../lib/supabase/client";
import type { Tables } from "../types/database";

import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import { toast } from "./toast/store";

type Ingredient = Pick<Tables<"ingredients">, "id" | "name" | "category">;

const SHELF_ICON: Record<RecipeDomain, "glass" | "pot"> = {
  cocktail: "glass",
  food: "pot",
};

const ctaClass =
  "inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90";

/**
 * The pantry's chips. `domain` selects a shelf's worth of vocabulary — the
 * store behind it is the same one either way. Without it this is the combined
 * view, which offers both domains' match CTAs rather than defaulting to one.
 */
export function PantryPanel({ domain }: { domain?: RecipeDomain }) {
  const pantry = usePantry();
  const ready = usePantryReady();
  // A cache of ingredient details; we render the subset still in the pantry, so
  // there is no need to clear it synchronously when the pantry changes.
  const [cache, setCache] = useState<Ingredient[]>([]);

  useEffect(() => {
    // Only fetch details for ids not already cached; skip entirely when the
    // pantry change introduced nothing new (e.g. a removal).
    const missing = pantry.filter((id) => !cache.some((it) => it.id === id));
    if (missing.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ingredients")
        .select("id,name,category")
        .in("id", missing);
      if (!ignore && data) {
        setCache((prev) => {
          const have = new Set(prev.map((it) => it.id));
          return [...prev, ...data.filter((it) => !have.has(it.id))];
        });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [pantry, cache]);

  const items = cache
    .filter((it) => pantry.includes(it.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const loadingCount = pantry.length - items.length;
  const shelf = domain ? DOMAIN_SHELF[domain] : "Your pantry";
  // One store, two shelves: the lens only decides which chips sit where. An
  // item whose details haven't arrived yet has no category, so it stays on the
  // shelf being looked at — that is where its skeleton renders, and the
  // heading counts it so the number matches the chips beneath it.
  const { mine, other } = domain
    ? splitByLens(items, domain)
    : { mine: items, other: [] };
  const shelfCount = domain ? mine.length + loadingCount : pantry.length;

  function chip(it: Ingredient) {
    return (
      <li key={it.id}>
        <button
          type="button"
          onClick={() => {
            removeFromPantry(it.id);
            toast(`Removed ${it.name} from your pantry`);
          }}
          title="Remove from pantry"
          className="group inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <span>{it.name}</span>
          <span className="opacity-40 group-hover:text-red-500 group-hover:opacity-100">
            ×
          </span>
        </button>
      </li>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {ready ? `${shelf} (${shelfCount})` : shelf}
        </h2>
        {ready && pantry.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearPantry();
              toast("Cleared your pantry");
            }}
            className="text-sm text-muted underline hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {!ready ? (
        // localStorage and auth haven't landed yet, so the pantry isn't empty —
        // it is unknown. Deciding either way here flashes the wrong answer at
        // every returning user.
        <ul aria-hidden className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={`hydrating-${i}`}>
              <Skeleton className="h-7.5 w-24 rounded-full" />
            </li>
          ))}
        </ul>
      ) : shelfCount === 0 ? (
        // Also the state a food-only pantry lands in on the Bar: this shelf is
        // empty even though the pantry is not, and the group below says so.
        <div className="mt-3">
          <EmptyState
            icon={domain ? SHELF_ICON[domain] : "pantry"}
            title={`${shelf} is empty`}
            body="Search above or browse the ingredients to add what you have on hand."
          />
        </div>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {mine.map(chip)}
            {loadingCount > 0 &&
              Array.from({ length: loadingCount }, (_, i) => (
                <li key={`loading-${i}`}>
                  <Skeleton className="h-7.5 w-24 rounded-full" />
                </li>
              ))}
          </ul>
          {domain ? (
            <Link
              href={DOMAIN_ROUTES[domain].matches}
              className={`mt-4 ${ctaClass}`}
            >
              {DOMAIN_MATCH_CTA[domain]}
            </Link>
          ) : (
            // Neither side leads on the combined view: an ingredient added here
            // counts towards a drink and towards dinner equally.
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={DOMAIN_ROUTES.cocktail.matches} className={ctaClass}>
                {DOMAIN_MATCH_CTA.cocktail}
              </Link>
              <Link href={DOMAIN_ROUTES.food.matches} className={ctaClass}>
                {DOMAIN_MATCH_CTA.food}
              </Link>
            </div>
          )}
        </>
      )}

      {ready && domain && other.length > 0 && (
        // Collapsed, never hidden: the other side stays visible so the pantry
        // reads as one store seen from here, not as two.
        <details className="mt-4 rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-muted">
            Also in your pantry · {other.length}{" "}
            {DOMAIN_SURFACE[otherDomain(domain)].toLowerCase()} item
            {other.length === 1 ? "" : "s"}
          </summary>
          <ul className="flex flex-wrap gap-2 px-4">{other.map(chip)}</ul>
          <p className="px-4 pb-3 pt-2 text-xs text-muted">
            These count toward the {DOMAIN_SURFACE[otherDomain(domain)]}. One
            pantry, both sides.
          </p>
        </details>
      )}
    </section>
  );
}