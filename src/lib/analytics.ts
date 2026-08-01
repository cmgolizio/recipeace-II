"use client";

// Product analytics, deliberately thin (docs/expansion-plan.md §17). Vercel
// Analytics is already loaded for page views; this adds the handful of custom
// events worth having, and tags each with the domain it happened in rather
// than minting a separate event name per domain.
//
// No platform, no queue, no consent machinery: if the script isn't there the
// call is a no-op.

import { track as vercelTrack } from "@vercel/analytics";

import type { DomainFilter } from "./recipes/domain";

export type AnalyticsEvent =
  | "domain_switched"
  | "search_submitted"
  | "shopping_ingredients_added";

export function track(
  event: AnalyticsEvent,
  properties: { domain: DomainFilter } & Record<string, string | number>,
): void {
  try {
    vercelTrack(event, properties);
  } catch {
    /* analytics must never break a user action */
  }
}
