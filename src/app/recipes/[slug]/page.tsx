"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { usePantry } from "../../../lib/pantry/store";
import { createClient } from "../../../lib/supabase/client";
import type { Database, Tables } from "../../../types/database";

type RecipeHeader = Pick<
  Tables<"recipes">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "method"
  | "glass"
  | "garnish"
  | "instructions"
  | "image_url"
>;
type StatusRow =
  Database["public"]["Functions"]["recipe_pantry_status"]["Returns"][number];

type Outcome =
  | { key: string; recipe: RecipeHeader; ingredients: StatusRow[] }
  | { key: string; notFound: true }
  | { key: string; error: string };

function StatusBadge({ row }: { row: StatusRow }) {
  if (row.status === "have") {
    return (
      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">
        ✓ in your bar
      </span>
    );
  }
  if (row.status === "substitute") {
    return (
      <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400">
        ↺ use {row.substitute_with}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-medium text-red-600/80 dark:text-red-400/80">
      ✗ missing
    </span>
  );
}

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const pantry = usePantry();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const pantryKey = [...pantry].sort((a, b) => a - b).join(",");
  const key = `${slug}::${pantryKey}`;

  useEffect(() => {
    let ignore = false;
    const ids = pantryKey === "" ? [] : pantryKey.split(",").map(Number);
    const outcomeKey = `${slug}::${pantryKey}`;
    (async () => {
      const supabase = createClient();
      const { data: header, error: headerErr } = await supabase
        .from("recipes")
        .select("id,slug,name,description,method,glass,garnish,instructions,image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (ignore) return;
      if (headerErr) {
        setOutcome({ key: outcomeKey, error: headerErr.message });
        return;
      }
      if (!header) {
        setOutcome({ key: outcomeKey, notFound: true });
        return;
      }
      const { data: ingredients, error: statusErr } = await supabase.rpc(
        "recipe_pantry_status",
        { p_recipe_id: header.id, pantry: ids },
      );
      if (ignore) return;
      if (statusErr) {
        setOutcome({ key: outcomeKey, error: statusErr.message });
        return;
      }
      setOutcome({
        key: outcomeKey,
        recipe: header,
        ingredients: ingredients ?? [],
      });
    })();
    return () => {
      ignore = true;
    };
  }, [slug, pantryKey]);

  const current = outcome?.key === key ? outcome : null;

  const backLink = (
    <Link href="/recipes" className="text-sm underline opacity-60 hover:opacity-100">
      ← All recipes
    </Link>
  );

  if (current === null) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="opacity-60">Loading…</p>
      </div>
    );
  }
  if ("error" in current) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load this recipe: {current.error}
        </p>
      </div>
    );
  }
  if ("notFound" in current) {
    return (
      <div className="space-y-4">
        {backLink}
        <h1 className="text-2xl font-semibold tracking-tight">Recipe not found</h1>
        <p className="opacity-70">There’s no cocktail at “{slug}”.</p>
      </div>
    );
  }

  const { recipe, ingredients } = current;
  const hasPantry = pantry.length > 0;
  const missingRequired = ingredients.filter(
    (i) => !i.is_optional && i.status === "missing",
  ).length;
  const substitutes = ingredients.filter((i) => i.status === "substitute").length;

  return (
    <article className="space-y-6">
      {backLink}

      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.image_url}
          alt={recipe.name}
          className="aspect-square w-full max-w-xs rounded-xl border border-black/10 object-cover dark:border-white/15"
        />
      )}

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
        {(recipe.method || recipe.glass) && (
          <p className="text-xs uppercase tracking-wide opacity-50">
            {[recipe.method, recipe.glass].filter(Boolean).join(" · ")}
          </p>
        )}
        {recipe.description && (
          <p className="pt-1 opacity-70">{recipe.description}</p>
        )}
      </header>

      {hasPantry && (
        <p
          className={
            missingRequired === 0
              ? "rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
              : "rounded-lg bg-black/[0.06] px-3 py-2 text-sm font-medium dark:bg-white/10"
          }
        >
          {missingRequired === 0
            ? substitutes > 0
              ? `You can make this — with ${substitutes} substitution${substitutes > 1 ? "s" : ""}.`
              : "You can make this with what’s in your bar."
            : `Missing ${missingRequired} ingredient${missingRequired > 1 ? "s" : ""}.`}
        </p>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Ingredients
        </h2>
        <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {ingredients.map((ri) => (
            <li
              key={ri.ingredient_id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                {ri.amount != null && <span>{ri.amount} </span>}
                {ri.unit && <span>{ri.unit} </span>}
                <span className="font-medium">{ri.name}</span>
                {ri.preparation && (
                  <span className="opacity-60">, {ri.preparation}</span>
                )}
                {ri.is_optional && (
                  <span className="opacity-50"> (optional)</span>
                )}
              </span>
              {hasPantry && <StatusBadge row={ri} />}
            </li>
          ))}
        </ul>
        {!hasPantry && (
          <p className="mt-3 text-sm opacity-60">
            <Link href="/" className="underline">
              Add ingredients to your bar
            </Link>{" "}
            to see what you have and what you’re missing.
          </p>
        )}
      </section>

      {recipe.instructions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Method
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {recipe.instructions.map((step, idx) => (
              <li key={idx} className="opacity-90">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.garnish && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
            Garnish
          </h2>
          <p className="mt-1 opacity-90">{recipe.garnish}</p>
        </section>
      )}
    </article>
  );
}