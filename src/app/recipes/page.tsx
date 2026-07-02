"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "../../lib/supabase/client";
import type { Tables } from "../../types/database";

type Recipe = Pick<
  Tables<"recipes">,
  "id" | "slug" | "name" | "description" | "method" | "glass" | "image_url"
>;

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select("id,slug,name,description,method,glass,image_url")
        .order("name");
      if (ignore) return;
      if (error) setError(error.message);
      else setRecipes(data ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const needle = filter.trim().toLowerCase();
  const visible = (recipes ?? []).filter(
    (r) =>
      needle === "" ||
      r.name.toLowerCase().includes(needle) ||
      (r.description ?? "").toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <p className="opacity-70">
          Browse the catalog. Open any cocktail to see the full build and what
          you’re missing from your bar.
        </p>
      </div>

      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter recipes by name…"
        aria-label="Filter recipes"
        autoComplete="off"
        className="w-full rounded-lg border border-black/15 bg-transparent px-4 py-2.5 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />

      {recipes === null && !error && <p className="opacity-60">Loading…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load recipes: {error}
        </p>
      )}
      {recipes !== null && recipes.length === 0 && (
        <p className="opacity-60">
          No recipes in the database yet. Run{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            supabase/seed_test_recipes.sql
          </code>{" "}
          to add some.
        </p>
      )}
      {recipes !== null && recipes.length > 0 && visible.length === 0 && (
        <p className="opacity-60">No recipes match “{filter}”.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.slug}`}
              className="block h-full overflow-hidden rounded-xl border border-black/10 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt=""
                  className="aspect-[3/2] w-full object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="font-semibold">{r.name}</h2>
                {(r.method || r.glass) && (
                  <p className="mt-0.5 text-xs uppercase tracking-wide opacity-50">
                    {[r.method, r.glass].filter(Boolean).join(" · ")}
                  </p>
                )}
                {r.description && (
                  <p className="mt-2 text-sm opacity-70">{r.description}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}