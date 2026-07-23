"use client";

import { useEffect, useState } from "react";

import { addToPantry, usePantry, usePantryReady } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Database } from "../types/database";

type Starter =
  Database["public"]["Functions"]["popular_ingredients"]["Returns"][number];

// The list is small and changes only when recipes do; fetch once and keep it
// across remounts, like the ingredient browser's cache.
let starterCache: Starter[] | null = null;

/**
 * "Popular starting points" for an empty bar: the ingredients required by the
 * most recipes, as tappable chips that add straight to the pantry. Renders
 * nothing once the bar has anything in it — and on fetch errors, since this
 * is a suggestion strip, not a required surface.
 */
export function StarterSuggestions() {
  const pantry = usePantry();
  const ready = usePantryReady();
  const [starters, setStarters] = useState<Starter[] | null>(starterCache);

  // Wait for hydration so the strip never flashes for a stocked bar.
  const show = ready && pantry.length === 0;

  useEffect(() => {
    if (!show || starters !== null) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("popular_ingredients", {
        max_results: 8,
      });
      if (!ignore && data) {
        starterCache = data;
        setStarters(data);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [show, starters]);

  if (!show || starters === null || starters.length === 0) return null;

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
              onClick={() => addToPantry(s.id)}
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