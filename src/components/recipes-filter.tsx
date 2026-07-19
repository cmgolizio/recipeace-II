"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Filter input for /recipes. Debounces typing, then updates the URL so the
 * Server Component re-renders with the new `q`. Uncontrolled so the RSC
 * re-render never clobbers in-progress typing.
 */
export function RecipesFilter({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      // Changing the filter always restarts from page 1 (no page param).
      router.replace(q ? `/recipes?q=${encodeURIComponent(q)}` : "/recipes");
    }, 300);
  }

  return (
    <input
      type="search"
      defaultValue={initialQuery}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Filter recipes by name…"
      aria-label="Filter recipes"
      autoComplete="off"
      className="w-full rounded-lg border border-black/15 bg-transparent px-4 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
    />
  );
}