"use client";

import { useEffect, useId, useRef, useState } from "react";

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

// Successful results per term, so returning to a previously-fetched term
// (e.g. backspacing) renders instantly without refiring the RPC.
const resultCache = new Map<string, SearchResult[]>();

export function IngredientSearch() {
  const pantry = usePantry();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  const [open, setOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2 || resultCache.has(term)) return;
    let ignore = false;
    // Debounce: only the last keystroke in a 200ms window fires a request.
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_ingredients", {
        q: term,
        max_results: 10,
      });
      if (ignore) return;
      if (error) {
        setState({ term, error: error.message });
      } else {
        resultCache.set(term, data ?? []);
        setState({ term, results: data ?? [] });
      }
    }, 200);
    return () => {
      ignore = true;
      clearTimeout(handle);
    };
  }, [term]);

  const cached = resultCache.get(term);
  const current =
    state?.term === term ? state : cached ? { term, results: cached } : null;
  const loading = term.length >= 2 && current === null;
  const results = current && "results" in current ? current.results : [];
  const error = current && "error" in current ? current.error : null;
  const panelOpen = open && term.length >= 2;
  // Clamped so an async result change can never leave a dangling highlight.
  const active =
    activeIndex >= 0 && activeIndex < results.length ? activeIndex : -1;

  function select(r: SearchResult) {
    if (pantry.includes(r.id)) {
      removeFromPantry(r.id);
    } else {
      addToPantry(r.id);
      // Clear so the user can immediately type the next ingredient.
      setQuery("");
      setActiveIndex(-1);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      // preventDefault stops the native search-input behavior of also
      // clearing the value; Escape only dismisses the panel.
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (term.length < 2) return;
    if (!panelOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(active < results.length - 1 ? active + 1 : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(active > 0 ? active - 1 : results.length - 1);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      select(results[active]);
    }
  }

  // Close when focus leaves the widget. Options keep focus on the input (their
  // pointerdown is prevented), so this never fires before an option click.
  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="w-full" onBlur={onBlur}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search ingredients. Try typing “bourbon”, “midori”, or “lim”"
        aria-label="Search ingredients"
        role="combobox"
        aria-expanded={panelOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          active >= 0 ? `${listboxId}-${results[active].id}` : undefined
        }
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-transparent px-4 py-3 text-base outline-none focus:border-black/40 dark:focus:border-white/50"
      />

      {panelOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Ingredient results"
          className="mt-2 divide-y divide-black/5 overflow-hidden rounded-lg border border-border bg-surface dark:divide-white/10"
        >
          {loading && <p className="px-4 py-3 text-sm text-muted">Searching…</p>}
          {error && (
            <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              Couldn’t search: {error}
            </p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">No ingredients found.</p>
          )}
          {results.map((r, i) => {
            const inPantry = pantry.includes(r.id);
            const highlighted = i === active;
            return (
              <div
                key={r.id}
                id={`${listboxId}-${r.id}`}
                role="option"
                aria-selected={highlighted}
                tabIndex={-1}
                // Prevent the input losing focus, so onBlur can't close the
                // panel before the click below registers.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => select(r)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left ${
                  highlighted
                    ? "bg-black/4 dark:bg-white/6"
                    : "hover:bg-black/4 dark:hover:bg-white/6"
                }`}
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
                      : "shrink-0 text-sm font-medium text-muted"
                  }
                >
                  {inPantry ? "✓ In bar" : "+ Add"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}