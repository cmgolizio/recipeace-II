"use client";

import { useEffect, useState } from "react";

import { addToPantry, usePantry, usePantryReady } from "../lib/pantry/store";
import type { RecipeDomain } from "../lib/recipes/domain";
import { createClient } from "../lib/supabase/client";
import type { Database } from "../types/database";

import { toast } from "./toast/store";

type Starter =
  Database["public"]["Functions"]["popular_ingredients"]["Returns"][number];

// The list is small and changes only when recipes do; fetch once and keep it
// across remounts, like the ingredient browser's cache. Keyed by domain — a
// single cached list would follow the user to the other side and offer it
// somebody else's stock.
const starterCache = new Map<string, Starter[]>();

// Keyed to the domain the list was fetched for, so a response never renders
// against the other side (the pattern almost-there-nudge.tsx uses).
type Outcome = { key: string; starters: Starter[] };

/**
 * "Popular starting points" for an empty pantry: the ingredients required by
 * the most recipes on this side, as tappable chips that add straight to the
 * pantry. Renders nothing once the pantry has anything in it — and on fetch
 * errors, since this is a suggestion strip, not a required surface.
 *
 * Without a domain it counts the whole catalog, which is only right on a
 * surface that belongs to neither side.
 */
export function StarterSuggestions({ domain }: { domain?: RecipeDomain }) {
  const pantry = usePantry();
  const ready = usePantryReady();
  const key = domain ?? "all";
  const [outcome, setOutcome] = useState<Outcome | null>(() => {
    const cached = starterCache.get(key);
    return cached ? { key, starters: cached } : null;
  });

  // Wait for hydration so the strip never flashes for a stocked pantry.
  const show = ready && pantry.length === 0;
  const current = outcome?.key === key ? outcome : null;

  useEffect(() => {
    if (!show || current !== null) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("popular_ingredients", {
        max_results: 8,
        p_domain: domain ?? null,
      });
      if (!ignore && data) {
        starterCache.set(key, data);
        setOutcome({ key, starters: data });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [show, current, key, domain]);

  const starters = current?.starters;
  if (!show || !starters || starters.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Popular starting points
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {starters.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                addToPantry(s.id);
                toast(`Added ${s.name} to your pantry`);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:bg-black/4 dark:hover:bg-white/6"
            >
              <span aria-hidden="true" className="opacity-50">
                +
              </span>
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}