"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearPantry, removeFromPantry, usePantry } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Tables } from "../types/database";

import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import { toast } from "./toast/store";

type Ingredient = Pick<Tables<"ingredients">, "id" | "name" | "category">;

export function PantryPanel() {
  const pantry = usePantry();
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

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          My bar ({pantry.length})
        </h2>
        {pantry.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearPantry();
              toast("Cleared your bar");
            }}
            className="text-sm text-muted underline hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {pantry.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon="glass"
            title="Your bar is empty"
            body="Search above or browse the ingredients to add what you have on hand."
          />
        </div>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => {
                    removeFromPantry(it.id);
                    toast(`Removed ${it.name} from your bar`);
                  }}
                  title="Remove from bar"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <span>{it.name}</span>
                  <span className="opacity-40 group-hover:text-red-500 group-hover:opacity-100">
                    ×
                  </span>
                </button>
              </li>
            ))}
            {loadingCount > 0 &&
              Array.from({ length: loadingCount }, (_, i) => (
                <li key={`loading-${i}`}>
                  <Skeleton className="h-[30px] w-24 rounded-full" />
                </li>
              ))}
          </ul>
          <Link
            href="/matches"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            See what I can make →
          </Link>
        </>
      )}
    </section>
  );
}