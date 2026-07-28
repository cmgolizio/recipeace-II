"use client";

import { setUnit, useUnit, useUnitReady } from "../lib/units/store";
import type { Unit } from "../lib/units/format";

const UNITS: Unit[] = ["oz", "ml"];

/**
 * oz/ml switch for ingredient amounts. The preference is global (it also
 * applies to the matches cards), so it lives beside the recipe detail's
 * ingredient list rather than in the already-dense header. Renders neutral
 * until the store hydrates, so SSR and the first client paint agree.
 */
export function UnitToggle() {
  const unit = useUnit();
  const ready = useUnitReady();
  return (
    <div
      role="group"
      aria-label="Measurement units"
      className="inline-flex rounded-lg border border-border p-0.5 text-xs"
    >
      {UNITS.map((u) => {
        const active = ready && unit === u;
        return (
          <button
            key={u}
            type="button"
            aria-pressed={active}
            onClick={() => setUnit(u)}
            className={
              active
                ? "rounded-md bg-black/6 px-2 py-1 font-medium dark:bg-white/10"
                : "rounded-md px-2 py-1 text-muted hover:text-foreground"
            }
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}