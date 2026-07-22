"use client";

// The shopping list as an array of ingredient names (the canonical names the
// matcher returns — a shopping list is a list of names, so no ids). Anonymous
// and localStorage-only by design: unlike the pantry store it registers no
// auth listener, keeping it decoupled from account state. DB-backed sync for
// signed-in users is a noted follow-up. Mirrors the pantry store's shape:
// module-level snapshot exposed via useSyncExternalStore, cross-tab sync via
// the storage event.

import { useSyncExternalStore } from "react";

const LS_KEY = "recipeace.shopping.v1";

type Snapshot = {
  names: string[];
  ready: boolean;
};

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Snapshot = { names: [], ready: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setNames(names: string[]): void {
  snapshot = { ...snapshot, names };
  emit();
}

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeLocal(names: string[]): void {
  try {
    if (names.length === 0) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, JSON.stringify(names));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { names: readLocal(), ready: true };
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) setNames(readLocal());
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
export function useShopping(): string[] {
  return useStore().names;
}

export function useShoppingReady(): boolean {
  return useStore().ready;
}

export function addToShopping(name: string): void {
  if (snapshot.names.includes(name)) return;
  setNames([...snapshot.names, name]);
  writeLocal(snapshot.names);
}

export function removeFromShopping(name: string): void {
  if (!snapshot.names.includes(name)) return;
  setNames(snapshot.names.filter((x) => x !== name));
  writeLocal(snapshot.names);
}

export function clearShopping(): void {
  if (snapshot.names.length === 0) return;
  setNames([]);
  writeLocal(snapshot.names);
}