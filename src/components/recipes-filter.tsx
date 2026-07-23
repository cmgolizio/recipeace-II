"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export type RecipeFilters = {
  q: string;
  method: string;
  glass: string;
  sort: "name" | "newest";
};

const selectClass =
  "rounded-lg border border-border bg-transparent px-3 py-1.5 outline-none focus:border-black/40 dark:focus:border-white/50";

/**
 * Search, facet, and sort controls for /recipes. Every change updates the
 * URL so the Server Component re-renders with the new params: typing is
 * debounced, selects commit immediately. Controls are uncontrolled and read
 * as a group from the form, so an RSC re-render never clobbers in-progress
 * typing and a select change never drops a pending search term.
 */
export function RecipesFilter({
  filters,
  methods,
  glasses,
}: {
  filters: RecipeFilters;
  methods: string[];
  glasses: string[];
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function commit() {
    if (timer.current) clearTimeout(timer.current);
    if (!form.current) return;
    const data = new FormData(form.current);
    const value = (name: string) =>
      typeof data.get(name) === "string" ? (data.get(name) as string).trim() : "";
    const params = new URLSearchParams();
    const q = value("q");
    if (q) params.set("q", q);
    const method = value("method");
    if (method) params.set("method", method);
    const glass = value("glass");
    if (glass) params.set("glass", glass);
    const sort = value("sort");
    if (sort && sort !== "name") params.set("sort", sort);
    // Changing any control always restarts from page 1 (no page param).
    const qs = params.toString();
    router.replace(qs ? `/recipes?${qs}` : "/recipes");
  }

  function handleQueryChange() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, 300);
  }

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="space-y-2"
    >
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        onChange={handleQueryChange}
        placeholder="Filter recipes by name…"
        aria-label="Filter recipes"
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-base outline-none focus:border-black/40 dark:focus:border-white/50"
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {methods.length > 0 && (
          <select
            name="method"
            defaultValue={filters.method}
            onChange={commit}
            aria-label="Filter by method"
            className={selectClass}
          >
            <option value="">All methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {glasses.length > 0 && (
          <select
            name="glass"
            defaultValue={filters.glass}
            onChange={commit}
            aria-label="Filter by glass"
            className={selectClass}
          >
            <option value="">All glasses</option>
            {glasses.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <select
          name="sort"
          defaultValue={filters.sort}
          onChange={commit}
          aria-label="Sort recipes"
          className={selectClass}
        >
          <option value="name">Name A–Z</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </form>
  );
}