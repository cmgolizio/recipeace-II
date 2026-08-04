"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { usePantry, usePantryReady } from "../lib/pantry/store";
import {
  DOMAIN_NOUN,
  DOMAIN_ROUTES,
  type RecipeDomain,
} from "../lib/recipes/domain";
import { createClient } from "../lib/supabase/client";

// Keyed to the pantry the count was computed for, so a stale response never
// renders against a changed pantry (same pattern as the matches page).
type Outcome = { key: string; count: number };

// What each side calls the last missing thing, and the plural of what it
// unlocks. The plural is spelled out rather than derived from DOMAIN_NOUN —
// "dish" doesn't take a bare "s".
const NUDGE_COPY: Record<RecipeDomain, { lead: string; plural: string }> = {
  cocktail: { lead: "one bottle away from", plural: "cocktails" },
  food: { lead: "one ingredient away from", plural: "dishes" },
};

/**
 * "You're one bottle away from N cocktails" / "one ingredient away from N
 * dishes" strip for a stocked pantry, linking to the domain's matches page
 * pre-filtered to missing ≤ 1. Renders nothing while the pantry is empty, when
 * nothing is one ingredient away, or on fetch errors — it's a nudge, not a
 * required surface.
 *
 * The domain is required: a nudge that doesn't say which side it counts for
 * is meaningless, and a domain-less count would silently mean "cocktails".
 */
export function AlmostThereNudge({ domain }: { domain: RecipeDomain }) {
  const pantry = usePantry();
  const ready = usePantryReady();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // The domain is part of the key: it counts a different catalog, so a
  // response fetched for one side must never render against the other.
  const key = `${domain}:${[...pantry].sort((a, b) => a - b).join(",")}`;

  useEffect(() => {
    if (pantry.length === 0) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("match_recipes_detail", {
        pantry: [...pantry],
        max_missing: 1,
        p_domain: domain,
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
  }, [key, pantry, domain]);

  const current = outcome?.key === key ? outcome : null;
  if (!ready || pantry.length === 0 || !current || current.count === 0) {
    return null;
  }

  const copy = NUDGE_COPY[domain];

  return (
    <Link
      href={`${DOMAIN_ROUTES[domain].matches}?missing=1`}
      className="block rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm hover:border-accent"
    >
      You’re {copy.lead} <span className="font-semibold">{current.count}</span>{" "}
      {current.count === 1 ? DOMAIN_NOUN[domain] : copy.plural} →
    </Link>
  );
}