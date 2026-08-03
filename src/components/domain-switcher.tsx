"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { track } from "../lib/analytics";
import {
  DOMAIN_ROUTES,
  DOMAIN_SURFACE,
  RECIPE_DOMAINS,
} from "../lib/recipes/domain";

/**
 * Bar ⇄ Kitchen. These are two places in the product, not two states of one
 * control, so they are links inside a labelled <nav> — the active one carries
 * aria-current, and a screen reader announces where it is going rather than
 * "pressed" (docs/expansion-plan.md §18).
 */
export function DomainSwitcher() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bar or Kitchen"
      className="inline-flex rounded-lg border border-border p-0.5 text-sm"
    >
      {RECIPE_DOMAINS.map((domain) => {
        const href = DOMAIN_ROUTES[domain].home;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={domain}
            href={href}
            onClick={() => {
              if (!active) track("domain_switched", { domain });
            }}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-md bg-black/6 px-2.5 py-1 font-medium text-foreground dark:bg-white/10"
                : "rounded-md px-2.5 py-1 text-muted hover:text-foreground"
            }
          >
            {DOMAIN_SURFACE[domain]}
          </Link>
        );
      })}
    </nav>
  );
}