"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { clearPantry, removeFromPantry, usePantry } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";
import type { Tables } from "../types/database";

type Ingredient = Pick<Tables<"ingredients">, "id" | "name" | "category">;

export function PantryPanel() {
  const pantry = usePantry();
  // A cache of ingredient details; we render the subset still in the pantry, so
  // there is no need to clear it synchronously when the pantry changes.
  const [cache, setCache] = useState<Ingredient[]>([]);

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ingredients")
        .select("id,name,category")
        .in("id", [...pantry]);
      if (!ignore && data) setCache(data);
    })();
    return () => {
      ignore = true;
    };
  }, [pantry]);

  const items = cache
    .filter((it) => pantry.includes(it.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const loadingCount = pantry.length - items.length;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          My bar ({pantry.length})
        </h2>
        {pantry.length > 0 && (
          <button
            type="button"
            onClick={clearPantry}
            className="text-sm underline opacity-60 hover:opacity-100"
          >
            Clear all
          </button>
        )}
      </div>

      {pantry.length === 0 ? (
        <p className="mt-3 text-sm opacity-60">
          Your bar is empty. Search above and add what you have on hand.
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => removeFromPantry(it.id)}
                  title="Remove from bar"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-sm hover:border-red-400 hover:bg-red-50 dark:border-white/20 dark:hover:bg-red-950/30"
                >
                  <span>{it.name}</span>
                  <span className="opacity-40 group-hover:text-red-500 group-hover:opacity-100">
                    ×
                  </span>
                </button>
              </li>
            ))}
            {loadingCount > 0 && (
              <li className="self-center text-sm opacity-50">Loading…</li>
            )}
          </ul>
          <Link
            href="/matches"
            className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            See what I can make →
          </Link>
        </>
      )}
    </section>
  );
}