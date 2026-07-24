"use client";

import { usePantry, usePantryReady } from "../lib/pantry/store";

const STEPS = ["Add what you own", "See your matches", "Shop the gap"];

/**
 * Compact hero for first-time visitors: what the app does, in three steps.
 * Gated on pantry hydration so returning users never see it flash, and gone
 * for good once the bar has anything in it.
 */
export function HomeHero() {
  const pantry = usePantry();
  const ready = usePantryReady();
  if (!ready || pantry.length > 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        Your shelf is already a cocktail menu
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tell us what you have and we’ll match it against every recipe —
        substitutions included.
      </p>
      <ol className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-6">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}