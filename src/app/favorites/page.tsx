"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useFavorites, useFavoritesReady } from "../../lib/favorites/store";
import { usePantryReady, useUser } from "../../lib/pantry/store";
import { createClient } from "../../lib/supabase/client";
import type { Tables } from "../../types/database";

type Recipe = Pick<
  Tables<"recipes">,
  "id" | "slug" | "name" | "description" | "method" | "glass" | "image_url"
>;

// Keyed to the favorites it was computed for, so loading/error/results are
// derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; recipes: Recipe[] }
  | { key: string; error: string };

export default function FavoritesPage() {
  const user = useUser();
  const authReady = usePantryReady();
  const favorites = useFavorites();
  const favoritesReady = useFavoritesReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = [...favorites].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (key === "") return;
    let ignore = false;
    const ids = key.split(",").map(Number);
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .select("id,slug,name,description,method,glass,image_url")
        .in("id", ids)
        .order("name");
      if (ignore) return;
      if (error) setOutcome({ key, error: error.message });
      else setOutcome({ key, recipes: data ?? [] });
    })();
    return () => {
      ignore = true;
    };
  }, [key]);

  const heading = (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
      <p className="opacity-70">Recipes you’ve saved to come back to.</p>
    </div>
  );

  // Wait for auth/favorites hydration before deciding what to show.
  if (!authReady || !favoritesReady) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="opacity-60">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="opacity-70">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to save recipes to your favorites.
        </p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="space-y-6">
        {heading}
        <p className="opacity-70">
          No favorites yet — tap “Save to favorites” on any{" "}
          <Link href="/recipes" className="underline">
            recipe
          </Link>{" "}
          to keep it here.
        </p>
      </div>
    );
  }

  const current = outcome?.key === key ? outcome : null;
  const loading = current === null;
  const error = current && "error" in current ? current.error : null;
  const recipes = current && "recipes" in current ? current.recipes : [];

  return (
    <div className="space-y-6">
      {heading}

      {loading && <p className="opacity-60">Loading…</p>}
      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load your favorites: {error}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.slug}`}
              className="block h-full overflow-hidden rounded-xl border border-black/10 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              {r.image_url && (
                <div className="relative aspect-[3/2] w-full">
                  <Image
                    src={r.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 360px, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold">
                  {r.name}{" "}
                  <span
                    aria-hidden
                    className="text-sm text-red-600 dark:text-red-400"
                  >
                    ♥
                  </span>
                </h2>
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