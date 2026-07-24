"use client";

// Ephemeral toast notifications. A module-level store in the same
// useSyncExternalStore shape as the pantry/shopping stores, so any client
// component can fire `toast("Added bourbon")` straight from an event handler —
// no context provider to thread through. Toasts auto-dismiss; nothing is
// persisted.

import { useSyncExternalStore } from "react";

export type Toast = { id: number; message: string };

const DISMISS_AFTER_MS = 2500;
const MAX_VISIBLE = 3;

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Toast[] = [];

let toasts: Toast[] = SERVER_SNAPSHOT;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string): void {
  const id = nextId++;
  // Cap the stack: rapid-fire toasts push the oldest out early. Their
  // dismiss timers still run, but dismissing an already-gone id is a no-op.
  toasts = [...toasts, { id, message }].slice(-MAX_VISIBLE);
  emit();
  setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => SERVER_SNAPSHOT,
  );
}
