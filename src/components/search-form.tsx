"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { track } from "../lib/analytics";
import {
  DOMAIN_SURFACE,
  RECIPE_DOMAINS,
  type DomainFilter,
} from "../lib/recipes/domain";

const TABS: { value: DomainFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  ...RECIPE_DOMAINS.map((domain) => ({
    value: domain as DomainFilter,
    label: DOMAIN_SURFACE[domain],
  })),
];

/**
 * Search box plus the All / Bar / Kitchen scope. Both write the URL, so the
 * Server Component re-runs the query — the search itself never happens in the
 * browser (docs/expansion-plan.md §10.1).
 */
export function SearchForm({
  q,
  domain,
}: {
  q: string;
  domain: DomainFilter;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function commit(nextDomain: DomainFilter = domain) {
    if (timer.current) clearTimeout(timer.current);
    const term = input.current?.value.trim() ?? "";
    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (nextDomain !== "all") params.set("domain", nextDomain);
    if (term) track("search_submitted", { domain: nextDomain });
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="space-y-2"
    >
      <input
        ref={input}
        type="search"
        name="q"
        defaultValue={q}
        onChange={() => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(), 300);
        }}
        placeholder="Search by name or ingredient…"
        aria-label="Search recipes"
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-transparent px-4 py-2.5 text-base outline-none focus:border-black/40 dark:focus:border-white/50"
      />
      <div
        role="group"
        aria-label="Search scope"
        className="inline-flex rounded-lg border border-border p-0.5 text-sm"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={domain === tab.value}
            onClick={() => commit(tab.value)}
            className={
              domain === tab.value
                ? "rounded-md bg-black/6 px-3 py-1 font-medium dark:bg-white/10"
                : "rounded-md px-3 py-1 text-muted hover:text-foreground"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </form>
  );
}
