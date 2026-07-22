"use client";

// The pantry as an array of ingredient ids. Source of truth depends on auth:
//   - anonymous  -> localStorage
//   - signed in  -> pantry_items table (owner-only RLS)
// On the first sign-in transition the anonymous (localStorage) pantry is
// migrated into pantry_items, then read back. Exposed via useSyncExternalStore
// so the public API (usePantry / addToPantry / ...) is unchanged for callers.
// Auth events arrive via the shared auth store (see ../auth/store.ts).

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getSupabase, onAuthUser } from "../auth/store";
import type { createClient } from "../supabase/client";

const LS_KEY = "recipeace.pantry.v1";

type Snapshot = {
  ids: number[];
  user: User | null;
  ready: boolean;
};

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Snapshot = { ids: [], user: null, ready: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let supabase: ReturnType<typeof createClient> | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setSnapshot(patch: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

// ── localStorage (anonymous pantry) ─────────────────────────────────────────
function readLocal(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

function writeLocal(ids: number[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function clearLocal(): void {
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

// ── DB (signed-in pantry) ───────────────────────────────────────────────────
async function loadDbPantry(userId: string): Promise<number[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("pantry_items")
    .select("ingredient_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.ingredient_id);
}

async function syncFromDb(): Promise<void> {
  const { user } = snapshot;
  if (!user) return;
  setSnapshot({ ids: await loadDbPantry(user.id) });
}

// React to auth changes. On the transition into a signed-in state, migrate the
// anonymous pantry into pantry_items, then read the merged pantry back.
async function onUser(user: User | null): Promise<void> {
  if (!supabase) return;
  if (user) {
    const wasSignedIn = snapshot.user !== null;
    if (!wasSignedIn) {
      const localIds = readLocal();
      if (localIds.length > 0) {
        await supabase.from("pantry_items").upsert(
          localIds.map((ingredient_id) => ({ user_id: user.id, ingredient_id })),
          { onConflict: "user_id,ingredient_id", ignoreDuplicates: true },
        );
      }
      clearLocal();
    }
    setSnapshot({ user, ids: await loadDbPantry(user.id), ready: true });
  } else {
    setSnapshot({ user: null, ids: readLocal(), ready: true });
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase = getSupabase();
  // Show the anonymous pantry immediately while auth resolves.
  snapshot = { ids: readLocal(), user: null, ready: false };
  onAuthUser((user) => {
    void onUser(user);
  });
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY && snapshot.user === null) {
      setSnapshot({ ids: readLocal() });
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
export function usePantry(): number[] {
  return useStore().ids;
}

export function useUser(): User | null {
  return useStore().user;
}

export function usePantryReady(): boolean {
  return useStore().ready;
}

export function addToPantry(id: number): void {
  if (snapshot.ids.includes(id)) return;
  const { user } = snapshot;
  setSnapshot({ ids: [...snapshot.ids, id] });
  if (user && supabase) {
    void supabase
      .from("pantry_items")
      .insert({ user_id: user.id, ingredient_id: id })
      .then(({ error }) => {
        if (error) void syncFromDb();
      });
  } else {
    writeLocal(snapshot.ids);
  }
}

export function removeFromPantry(id: number): void {
  if (!snapshot.ids.includes(id)) return;
  const { user } = snapshot;
  setSnapshot({ ids: snapshot.ids.filter((x) => x !== id) });
  if (user && supabase) {
    void supabase
      .from("pantry_items")
      .delete()
      .eq("user_id", user.id)
      .eq("ingredient_id", id)
      .then(({ error }) => {
        if (error) void syncFromDb();
      });
  } else {
    writeLocal(snapshot.ids);
  }
}

export function clearPantry(): void {
  if (snapshot.ids.length === 0) return;
  const { user } = snapshot;
  setSnapshot({ ids: [] });
  if (user && supabase) {
    void supabase
      .from("pantry_items")
      .delete()
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) void syncFromDb();
      });
  } else {
    clearLocal();
  }
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}