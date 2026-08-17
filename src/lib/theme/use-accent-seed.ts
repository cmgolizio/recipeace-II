"use client";

import { useState, useSyncExternalStore } from "react";

import { randomSeed } from "./accents";

// Nothing ever changes, so the subscription is inert: this store exists only
// to ask React one question — has this tree hydrated yet?
const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * A seed that re-deals a client surface's accents once per page load, and
 * holds still while the page is used.
 *
 * The seed reads as `undefined` for the server render *and* for the hydrating
 * render, so both produce the deal derived from the list itself and the HTML
 * matches exactly. React swaps to the client snapshot after hydration, which
 * is when the random seed lands. That ordering is the whole point: a random
 * value taken during the hydrating render would mismatch, and React answers a
 * mismatch by discarding the server HTML for that subtree and re-rendering it
 * — the one genuinely expensive way to do this (ux-plan.md D5).
 *
 * useSyncExternalStore rather than an effect, so React schedules the swap
 * itself instead of us triggering a cascading render out of one.
 *
 * The seed is generated once per mount, so colours hold still across every
 * re-render in between — typing in a filter or toggling oz/ml does not
 * recolour the page. `key` re-deals without a remount, for a surface that
 * outlives navigation: the header lives in the root layout, so it passes the
 * pathname.
 *
 * Cost: one extra render of the surface, changing class names only — no
 * layout, no refetch, no request. The deal itself is ~4µs for a full catalog
 * page.
 */
export function useAccentSeed(key?: string): number | undefined {
  const hydrated = useSyncExternalStore(subscribe, onClient, onServer);
  const [seed, setSeed] = useState(randomSeed);
  // Re-deal when the key changes, without waiting for a remount. Adjusting
  // state during render is React's own answer to "reset when a prop changes";
  // it re-runs this component before anything is committed, and nothing else.
  const [seededFor, setSeededFor] = useState(key);
  if (key !== seededFor) {
    setSeededFor(key);
    setSeed(randomSeed());
  }
  return hydrated ? seed : undefined;
}
