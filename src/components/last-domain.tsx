"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useLastDomain, writeLastDomain } from "../lib/domain/last";
import {
  DOMAIN_CONTINUE,
  DOMAIN_ROUTES,
  type RecipeDomain,
} from "../lib/recipes/domain";

/**
 * Records the side being worked on. Renders nothing — the domain surfaces are
 * server components, and remembering where the user is is the only client work
 * they need (restructure-plan.md 3.4).
 */
export function RememberDomain({ domain }: { domain: RecipeDomain }) {
  useEffect(() => {
    writeLastDomain(domain);
  }, [domain]);
  return null;
}

/**
 * "Continue in the Bar →" on the chooser, for someone who has been here before.
 * Deliberately a link and not a redirect: sending `/` to the last domain makes
 * `/` unreachable and breaks the back button out of a domain (3.4). Renders
 * nothing until the store has read localStorage, which is after hydration.
 */
export function ContinueInDomain() {
  const domain = useLastDomain();
  if (!domain) return null;

  return (
    <Link
      href={DOMAIN_ROUTES[domain].home}
      className="inline-block text-sm font-medium underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
    >
      {DOMAIN_CONTINUE[domain]}
    </Link>
  );
}