"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { track } from "../lib/analytics";
import { writeLastDomain } from "../lib/domain/last";
import {
  DOMAIN_ROUTES,
  DOMAIN_SURFACE,
  RECIPE_DOMAINS,
} from "../lib/recipes/domain";

/** The sub-surfaces both domain subtrees have, so a switch can carry across. */
const SUB_SURFACES = ["matches", "recipes"] as const;

function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Which sub-surface the user is looking at, whichever domain owns it — so
 * switching sides from the Kitchen's matches lands on the Bar's matches rather
 * than the Bar's hub. Landing on the hub means the matcher never runs, and the
 * only way through to the other side's matches is back out via the pantry.
 * Anywhere outside a domain subtree has no counterpart, so it goes to the home.
 */
function currentSurface(pathname: string): "home" | "matches" | "recipes" {
  for (const domain of RECIPE_DOMAINS) {
    for (const surface of SUB_SURFACES) {
      if (isUnder(pathname, DOMAIN_ROUTES[domain][surface])) return surface;
    }
  }
  return "home";
}

/**
 * Bar ⇄ Kitchen. These are two places in the product, not two states of one
 * control, so they are links inside a labelled <nav> — the active one carries
 * aria-current, and a screen reader announces where it is going rather than
 * "pressed" (docs/expansion-plan.md §18).
 */
export function DomainSwitcher() {
  const pathname = usePathname();
  const surface = currentSurface(pathname);
  return (
    <nav
      aria-label="Bar or Kitchen"
      className="inline-flex rounded-lg border border-border p-0.5 text-sm"
    >
      {RECIPE_DOMAINS.map((domain) => {
        const href = DOMAIN_ROUTES[domain][surface];
        // Active is the whole subtree, not the link target: on /bar/matches
        // the Bar is where you are, whichever page the link points at.
        const active = isUnder(pathname, DOMAIN_ROUTES[domain].home);
        return (
          <Link
            key={domain}
            href={href}
            onClick={() => {
              // Recorded even for the side already active: this is where the
              // user is choosing to be, and `/` offers it back on return.
              writeLastDomain(domain);
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