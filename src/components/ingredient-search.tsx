"use client";

import { useEffect, useState } from "react";

import { addToPantry, removeFromPantry, usePantry } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Database } from "../types/database";

type SearchResult =
  Database["public"]["Functions"]["search_ingredients"]["Returns"][number];

// Keyed to the search term so stale responses are never shown and loading/error
// can be derived during render (no synchronous setState in the effect).
type SearchState =
  | { term: string; results: SearchResult[] }
  | { term: string; error: string };

export function IngredientSearch() {
  const pantry = usePantry();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState | null>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let ignore = false;
    // Debounce: only the last keystroke in a 200ms window fires a request.
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_ingredients", {
        q: term,
        max_results: 10,
      });
      if (ignore) return;
      setState(
        error ? { term, error: error.message } : { term, results: data ?? [] },
      );
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(handle);
    };
  }, [term]);

  const current = state?.term === term ? state : null;
  const loading = term.length >= 2 && current === null;
  const results = current && "results" in current ? current.results : [];
  const error = current && "error" in current ? current.error : null;

  return (
    <div className="w-full">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search ingredients — try “bourbon”, “midori”, or “lim”"
        aria-label="Search ingredients"
        autoComplete="off"
        className="w-full rounded-lg border border-black/15 bg-transparent px-4 py-3 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />

      {term.length >= 2 && (
        <div className="mt-2 divide-y divide-black/5 overflow-hidden rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {loading && <p className="px-4 py-3 text-sm opacity-60">Searching…</p>}
          {error && (
            <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              Couldn’t search: {error}
            </p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-3 text-sm opacity-60">No ingredients found.</p>
          )}
          {results.map((r) => {
            const inPantry = pantry.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  inPantry ? removeFromPantry(r.id) : addToPantry(r.id)
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{r.name}</span>
                  {r.matched_alias && (
                    <span className="opacity-50"> · “{r.matched_alias}”</span>
                  )}
                  <span className="ml-2 text-xs uppercase tracking-wide opacity-40">
                    {r.category.replace("_", " ")}
                  </span>
                </span>
                <span
                  className={
                    inPantry
                      ? "shrink-0 text-sm font-medium text-green-700 dark:text-green-400"
                      : "shrink-0 text-sm font-medium opacity-70"
                  }
                >
                  {inPantry ? "✓ In bar" : "+ Add"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}