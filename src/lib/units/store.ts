"use client";

// The oz/ml display preference. Anonymous and localStorage-only — it's a
// display setting, not user data, so like the shopping store it registers no
// auth listener. Mirrors the pantry/shopping store shape: module-level
// snapshot exposed via useSyncExternalStore, a stable server snapshot for
// hydration, a ready flag, and cross-tab sync via the storage event.

import { useSyncExternalStore } from "react";

import type { Unit } from "./format";

const LS_KEY = "recipeace.unit.v1";
const DEFAULT_UNIT: Unit = "oz";

type Snapshot = {
  unit: Unit;
  ready: boolean;
};

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Snapshot = { unit: DEFAULT_UNIT, ready: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function readLocal(): Unit {
  if (typeof window === "undefined") return DEFAULT_UNIT;
  try {
    return window.localStorage.getItem(LS_KEY) === "ml" ? "ml" : DEFAULT_UNIT;
  } catch {
    return DEFAULT_UNIT;
  }
}

function writeLocal(unit: Unit): void {
  try {
    window.localStorage.setItem(LS_KEY, unit);
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = { unit: readLocal(), ready: true };
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      snapshot = { ...snapshot, unit: readLocal() };
      emit();
    }
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
export function useUnit(): Unit {
  return useStore().unit;
}

export function useUnitReady(): boolean {
  return useStore().ready;
}

export function setUnit(unit: Unit): void {
  if (snapshot.unit === unit) return;
  snapshot = { ...snapshot, unit };
  emit();
  writeLocal(unit);
}