"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePantry } from "../lib/pantry/store";
import { addToShopping, useShopping } from "../lib/shopping/store";
import { createClient } from "../lib/supabase/client";
import { formatQuantity, type Unit } from "../lib/units/format";
import { useUnit } from "../lib/units/store";
import type { Database } from "../types/database";

import { FavoriteButton } from "./favorite-button";
import { toast } from "./toast/store";
import { UnitToggle } from "./unit-toggle";

/** A plain recipe ingredient row, fetched server-side by the detail page. */
export type IngredientRow = {
  ingredient_id: number;
  amount: number | null;
  unit: string | null;
  preparation: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  display_order: number;
  name: string;
  slug: string | null;
};

type StatusRow =
  Database["public"]["Functions"]["recipe_pantry_status"]["Returns"][number];

// Keyed to the pantry it was computed for, so loading/error/results are
// derived during render rather than set synchronously in the effect.
type Outcome =
  | { key: string; statuses: StatusRow[] }
  | { key: string; error: string };

function StatusBadge({ row }: { row: StatusRow }) {
  if (row.status === "have") {
    return (
      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">
        {row.derived_from ? `✓ via ${row.derived_from}` : "✓ in your bar"}
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

function AddToListButton({ name }: { name: string }) {
  const shopping = useShopping();
  if (shopping.includes(name)) {
    return (
      <span title="On your shopping list" className="text-xs opacity-50">
        ✓ listed
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Add ${name} to shopping list`}
      title="Add to shopping list"
      onClick={() => {
        addToShopping(name);
        toast(`Added ${name} to your shopping list`);
      }}
      className="rounded-md border border-border px-1.5 py-0.5 text-xs font-medium hover:bg-black/4 dark:hover:bg-white/6"
    >
      + list
    </button>
  );
}

/** One ingredient line: quantity, name, and the pantry badge once it lands. */
function IngredientItem({
  row,
  status,
  unit,
  scale,
}: {
  row: IngredientRow;
  status: StatusRow | undefined;
  unit: Unit;
  scale: number;
}) {
  const quantity = formatQuantity(row.amount, row.unit, unit, scale);
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        {quantity.amount && <span>{quantity.amount} </span>}
        {quantity.unit && <span>{quantity.unit} </span>}
        {row.slug ? (
          <Link
            href={`/ingredients/${row.slug}`}
            className="font-medium underline decoration-border underline-offset-2 hover:decoration-current"
          >
            {row.name}
          </Link>
        ) : (
          <span className="font-medium">{row.name}</span>
        )}
        {row.preparation && (
          <span className="text-muted">, {row.preparation}</span>
        )}
        {row.is_optional && <span className="opacity-50"> (optional)</span>}
      </span>
      {status && (
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge row={status} />
          {status.status === "missing" && <AddToListButton name={row.name} />}
        </span>
      )}
    </li>
  );
}

const SCALE_PRESETS = [1, 2, 4];
const MAX_SCALE = 12;

/** Batch multiplier for the ingredient amounts: presets plus a ±1 stepper. */
function ServingScaler({
  scale,
  onChange,
}: {
  scale: number;
  onChange: (next: number) => void;
}) {
  const stepClass =
    "rounded-md px-2 py-1 text-muted enabled:hover:text-foreground disabled:opacity-30";
  return (
    <div
      role="group"
      aria-label="Scale the recipe"
      className="inline-flex items-center rounded-lg border border-border p-0.5 text-xs"
    >
      {SCALE_PRESETS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={scale === n}
          onClick={() => onChange(n)}
          className={
            scale === n
              ? "rounded-md bg-black/6 px-2 py-1 font-medium dark:bg-white/10"
              : "rounded-md px-2 py-1 text-muted hover:text-foreground"
          }
        >
          {n}×
        </button>
      ))}
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        aria-label="Fewer servings"
        disabled={scale <= 1}
        onClick={() => onChange(Math.max(1, scale - 1))}
        className={stepClass}
      >
        −
      </button>
      <span aria-live="polite" className="w-7 text-center font-medium tabular-nums">
        {scale}×
      </span>
      <button
        type="button"
        aria-label="More servings"
        disabled={scale >= MAX_SCALE}
        onClick={() => onChange(Math.min(MAX_SCALE, scale + 1))}
        className={stepClass}
      >
        +
      </button>
    </div>
  );
}

/**
 * Client island for the recipe detail page: renders the ingredient list from
 * server-fetched rows immediately, then overlays pantry-status badges and the
 * "you can make this" banner once recipe_pantry_status resolves. Badges sit in
 * the row's existing right-hand slot, so nothing shifts when they appear.
 */
export function RecipePantryStatus({
  recipeId,
  ingredients,
}: {
  recipeId: number;
  ingredients: IngredientRow[];
}) {
  const pantry = usePantry();
  const unit = useUnit();
  const [scale, setScale] = useState(1);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const pantryKey = [...pantry].sort((a, b) => a - b).join(",");
  const key = `${recipeId}::${pantryKey}`;

  useEffect(() => {
    if (pantryKey === "") return;
    let ignore = false;
    const ids = pantryKey.split(",").map(Number);
    const outcomeKey = `${recipeId}::${pantryKey}`;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("recipe_pantry_status", {
        p_recipe_id: recipeId,
        pantry: ids,
      });
      if (ignore) return;
      if (error) setOutcome({ key: outcomeKey, error: error.message });
      else setOutcome({ key: outcomeKey, statuses: data ?? [] });
    })();
    return () => {
      ignore = true;
    };
  }, [recipeId, pantryKey]);

  const hasPantry = pantry.length > 0;
  const current = outcome?.key === key ? outcome : null;
  const statuses =
    hasPantry && current && "statuses" in current ? current.statuses : null;
  const statusError =
    hasPantry && current && "error" in current ? current.error : null;

  const statusById = new Map(statuses?.map((s) => [s.ingredient_id, s]));
  const missingRequired = (statuses ?? []).filter(
    (s) => !s.is_optional && s.status === "missing",
  ).length;
  const substitutes = (statuses ?? []).filter(
    (s) => s.status === "substitute",
  ).length;

  // Garnish lines get their own section, so a garnish isn't listed twice —
  // once here and again in the recipe's free-text garnish field.
  const poured = ingredients.filter((ri) => !ri.is_garnish);
  const garnishes = ingredients.filter((ri) => ri.is_garnish);

  return (
    <>
      <FavoriteButton recipeId={recipeId} />

      {statuses !== null && (
        <p
          className={
            missingRequired === 0
              ? "rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
              : "rounded-lg bg-black/6 px-3 py-2 text-sm font-medium dark:bg-white/10"
          }
        >
          {missingRequired === 0
            ? substitutes > 0
              ? `You can make this — with ${substitutes} substitution${substitutes > 1 ? "s" : ""}.`
              : "You can make this with what’s in your bar."
            : `Missing ${missingRequired} ingredient${missingRequired > 1 ? "s" : ""}.`}
        </p>
      )}
      {statusError !== null && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn’t check this against your bar: {statusError}
        </p>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Ingredients
          </h2>
          <div className="flex items-center gap-2">
            <ServingScaler scale={scale} onChange={setScale} />
            <UnitToggle />
          </div>
        </div>
        <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
          {poured.map((ri) => (
            <IngredientItem
              key={ri.ingredient_id}
              row={ri}
              status={statusById.get(ri.ingredient_id)}
              unit={unit}
              scale={scale}
            />
          ))}
        </ul>
        {!hasPantry && (
          <p className="mt-3 text-sm text-muted">
            <Link href="/" className="underline">
              Add ingredients to your bar
            </Link>{" "}
            to see what you have and what you’re missing.
          </p>
        )}
      </section>

      {garnishes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Garnish
          </h2>
          <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {garnishes.map((ri) => (
              <IngredientItem
                key={ri.ingredient_id}
                row={ri}
                status={statusById.get(ri.ingredient_id)}
                unit={unit}
                scale={scale}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}