"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePantry, usePantryReady } from "../lib/pantry/store";
import { createClient } from "../lib/supabase/client";

// Keyed to the pantry the count was computed for, so a stale response never
// renders against a changed bar (same pattern as the matches page).
type Outcome = { key: string; count: number };

/**
 * "You're one bottle away from N cocktails" strip for a stocked bar, linking
 * to the matches page pre-filtered to missing ≤ 1. Renders nothing while the
 * bar is empty, when nothing is one ingredient away, or on fetch errors —
 * it's a nudge, not a required surface.
 */
export function AlmostThereNudge() {
  const pantry = usePantry();
  const ready = usePantryReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const key = [...pantry].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("match_recipes_detail", {
        pantry: [...pantry],
        max_missing: 1,
      });
      if (ignore) return;
      const count = error
        ? 0
        : (data ?? []).filter((m) => m.missing_count === 1).length;
      setOutcome({ key, count });
    })();
    return () => {
      ignore = true;
    };
  }, [key, pantry]);

  const current = outcome?.key === key ? outcome : null;
  if (!ready || pantry.length === 0 || !current || current.count === 0) {
    return null;
  }

  return (
    <Link
      href="/matches?missing=1"
      className="block rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm hover:border-accent"
    >
      You’re one bottle away from{" "}
      <span className="font-semibold">{current.count}</span> cocktail
      {current.count === 1 ? "" : "s"} →
    </Link>
  );
}
