"use client";

// Which side the user last worked on, so the chooser at `/` can offer to pick
// it back up (restructure-plan.md 3.4).
//
// Mirrors the unit store's shape: a module-level snapshot behind
// useSyncExternalStore, a stable server snapshot so hydration matches, and the
// same defensive try/catch around localStorage. No storage listener — unlike a
// display preference this is read once, on `/`, and a switch in another tab is
// not worth waking this one for.
//
// Nothing redirects on the value: `/` must always render `/` (3.4).

import { useSyncExternalStore } from "react";

import { isRecipeDomain, type RecipeDomain } from "../recipes/domain";

const LS_KEY = "recipeace.domain.v1";

// Stable reference used for SSR and the initial (pre-subscribe) client render.
const SERVER_SNAPSHOT: RecipeDomain | null = null;

let snapshot: RecipeDomain | null = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

/** Null when unset, unreadable, or holding something that isn't a domain. */
function readLocal(): RecipeDomain | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return isRecipeDomain(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeLocal(domain: RecipeDomain): void {
  try {
    window.localStorage.setItem(LS_KEY, domain);
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = readLocal();
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RecipeDomain | null {
  return snapshot;
}

function getServerSnapshot(): RecipeDomain | null {
  return SERVER_SNAPSHOT;
}

// ── Public API ──────────────────────────────────────────────────────────────
export function useLastDomain(): RecipeDomain | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function writeLastDomain(domain: RecipeDomain): void {
  writeLocal(domain);
  if (snapshot === domain) return;
  snapshot = domain;
  for (const l of listeners) l();
}
