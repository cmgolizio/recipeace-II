"use client";

import { useEffect, useState } from "react";

import { createClient } from "../lib/supabase/client";

// The staple set is small and world-readable; fetch it once per page load and
// keep it across remounts.
let stapleCache: string[] | null = null;

/**
 * Makes the staple assumption visible instead of leaving it a surprise
 * (docs/expansion-plan.md §11.4). Matching treats these as owned by everyone,
 * in both domains, so a recipe never asks you whether you have water.
 *
 * The list is read from the database rather than written here — a note that
 * drifts from the policy is worse than no note.
 */
export function StapleNote() {
  const [staples, setStaples] = useState<string[] | null>(stapleCache);

  useEffect(() => {
    if (staples !== null) return;
    let ignore = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ingredients")
        .select("name")
        .eq("is_staple", true)
        .order("name");
      if (ignore || !data) return;
      stapleCache = data.map((row) => row.name);
      setStaples(stapleCache);
    })();
    return () => {
      ignore = true;
    };
  }, [staples]);

  if (staples === null || staples.length === 0) return null;
  return (
    <p className="text-xs text-muted">
      Matches assume you have {staples.join(", ")} — those never count as
      missing.
    </p>
  );
}
