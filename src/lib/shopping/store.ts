"use client";

// The shopping list: ingredient names, each remembering the recipe it came
// from. Names rather than ids because a shopping list is a list of names —
// but an item added from a recipe carries that recipe's slug, title and
// domain, so the list can say where it came from and group by it
// (docs/expansion-plan.md §37).
//
// Anonymous and localStorage-only by design: unlike the pantry store it
// registers no auth listener, keeping it decoupled from account state.
// DB-backed sync for signed-in users is a noted follow-up. Mirrors the pantry
// store's shape: module-level snapshot exposed via useSyncExternalStore,
// cross-tab sync via the storage event.

import { useSyncExternalStore } from "react";

import type { RecipeDomain } from "../recipes/domain";

const LS_KEY = "recipeace.shopping.v2";
/** Pre-expansion format: a bare array of names, no provenance. */
const LEGACY_LS_KEY = "recipeace.shopping.v1";

/** Where an item came from, when it came from a recipe. */
export type ShoppingSource = {
  slug: string;
  name: string;
  domain: RecipeDomain;
};

export type ShoppingItem = {
  name: string;
  /** Absent for a manually added item. */
  from?: ShoppingSource;
};

type Snapshot = {
  items: ShoppingItem[];
  ready: boolean;
};

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Snapshot = { items: [], ready: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setItems(items: ShoppingItem[]): void {
  snapshot = { ...snapshot, items };
  emit();
}

function parseItem(value: unknown): ShoppingItem | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || item.name === "") return null;
  const from = item.from as Record<string, unknown> | undefined;
  if (
    from &&
    typeof from.slug === "string" &&
    typeof from.name === "string" &&
    (from.domain === "cocktail" || from.domain === "food")
  ) {
    return {
      name: item.name,
      from: { slug: from.slug, name: from.name, domain: from.domain },
    };
  }
  return { name: item.name };
}

function readLocal(): ShoppingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(parseItem)
        .filter((item): item is ShoppingItem => item !== null);
    }
    // A list saved before the expansion: names only, no provenance to recover.
    const legacy = window.localStorage.getItem(LEGACY_LS_KEY);
    if (!legacy) return [];
    const parsed: unknown = JSON.parse(legacy);
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed
      .filter((x): x is string => typeof x === "string")
      .map((name) => ({ name }));
    writeLocal(migrated);
    window.localStorage.removeItem(LEGACY_LS_KEY);
    return migrated;
  } catch {
    return [];
  }
}

function writeLocal(items: ShoppingItem[]): void {
  try {
    if (items.length === 0) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { items: readLocal(), ready: true };
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) setItems(readLocal());
  });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

function useStore(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── Public API ──────────────────────────────────────────────────────────────
export function useShoppingItems(): ShoppingItem[] {
  return useStore().items;
}

/**
 * The current list outside React. The hooks are the usual way in; this exists
 * because every mutator below needs the stored list loaded before it writes,
 * whether or not a component has subscribed yet.
 */
export function shoppingItems(): ShoppingItem[] {
  start();
  return snapshot.items;
}

/** Just the names — what the "already on your list" checks need. */
export function useShopping(): string[] {
  return useStore().items.map((item) => item.name);
}

export function useShoppingReady(): boolean {
  return useStore().ready;
}

/**
 * Add an ingredient, remembering where it came from. An ingredient already on
 * the list is left alone — including its original provenance, since the first
 * recipe that sent you shopping is the one worth remembering.
 */
export function addToShopping(name: string, from?: ShoppingSource): void {
  if (shoppingItems().some((item) => item.name === name)) return;
  setItems([...snapshot.items, from ? { name, from } : { name }]);
  writeLocal(snapshot.items);
}

export function removeFromShopping(name: string): void {
  if (!shoppingItems().some((item) => item.name === name)) return;
  setItems(snapshot.items.filter((item) => item.name !== name));
  writeLocal(snapshot.items);
}

export function clearShopping(): void {
  if (shoppingItems().length === 0) return;
  setItems([]);
  writeLocal(snapshot.items);
}