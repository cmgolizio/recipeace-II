"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export type FoodFilters = {
  q: string;
  course: string;
  cuisine: string;
  difficulty: string;
  maxMinutes: number;
  sort: string;
};

const selectClass =
  "rounded-lg border border-border bg-transparent px-3 py-1.5 outline-none focus:border-black/40 dark:focus:border-white/50";

/** The time buckets a cook actually thinks in. */
const TIME_LIMITS = [15, 30, 60] as const;

/**
 * Search, facet and sort controls for the Kitchen catalog. Same mechanics as
 * the Bar's filter — every change rewrites the URL so the Server Component
 * re-renders, typing is debounced, controls are uncontrolled and read as a
 * group — but the facets are food's: course, cuisine, total time, difficulty
 * (docs/expansion-plan.md §13.3, §35).
 */
export function FoodFilter({
  filters,
  courses,
  cuisines,
  difficulties,
}: {
  filters: FoodFilters;
  courses: string[];
  cuisines: string[];
  difficulties: string[];
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
    for (const name of ["q", "course", "cuisine", "difficulty", "time"]) {
      const v = value(name);
      if (v) params.set(name, v);
    }
    const sort = value("sort");
    if (sort && sort !== "name") params.set("sort", sort);
    // Changing any control always restarts from page 1 (no page param).
    const qs = params.toString();
    router.replace(qs ? `/kitchen/recipes?${qs}` : "/kitchen/recipes");
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
        {courses.length > 0 && (
          <select
            name="course"
            defaultValue={filters.course}
            onChange={commit}
            aria-label="Filter by course"
            className={selectClass}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {cuisines.length > 0 && (
          <select
            name="cuisine"
            defaultValue={filters.cuisine}
            onChange={commit}
            aria-label="Filter by cuisine"
            className={selectClass}
          >
            <option value="">All cuisines</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          name="time"
          defaultValue={filters.maxMinutes > 0 ? String(filters.maxMinutes) : ""}
          onChange={commit}
          aria-label="Filter by total time"
          className={selectClass}
        >
          <option value="">Any time</option>
          {TIME_LIMITS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min or less
            </option>
          ))}
        </select>
        {difficulties.length > 0 && (
          <select
            name="difficulty"
            defaultValue={filters.difficulty}
            onChange={commit}
            aria-label="Filter by difficulty"
            className={selectClass}
          >
            <option value="">Any difficulty</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
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
          <option value="name">A–Z</option>
          <option value="time">Quickest first</option>
          <option value="newest">Newest</option>
        </select>
      </div>
    </form>
  );
}