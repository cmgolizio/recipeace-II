"use client";

// Favorited recipe ids, backed by the favorite_recipes table (owner-only
// RLS). Signed-in only: anonymous users have no favorites — the UI shows a
// log-in prompt instead of a heart. Mirrors the pantry store: loaded on auth
// changes (via the shared auth store), optimistic add/remove with
// rollback-via-refetch on error, exposed via useSyncExternalStore.

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

import { getSupabase, onAuthUser } from "../auth/store";
import type { createClient } from "../supabase/client";

type Snapshot = {
  ids: number[];
  ready: boolean;
};

// Stable reference used for SSR and the initial (pre-subscribe) client render,
// so hydration matches.
const SERVER_SNAPSHOT: Snapshot = { ids: [], ready: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let supabase: ReturnType<typeof createClient> | null = null;
let user: User | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setSnapshot(patch: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

async function loadDbFavorites(userId: string): Promise<number[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("favorite_recipes")
    .select("recipe_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.recipe_id);
}

async function syncFromDb(): Promise<void> {
  if (!user) return;
  setSnapshot({ ids: await loadDbFavorites(user.id) });
}

async function onUser(next: User | null): Promise<void> {
  user = next;
  if (next) {
    setSnapshot({ ids: await loadDbFavorites(next.id), ready: true });
  } else {
    setSnapshot({ ids: [], ready: true });
  }
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase = getSupabase();
  onAuthUser((next) => {
    void onUser(next);
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
export function useFavorites(): number[] {
  return useStore().ids;
}

export function useFavoritesReady(): boolean {
  return useStore().ready;
}

export function addFavorite(recipeId: number): void {
  if (!user || snapshot.ids.includes(recipeId)) return;
  const owner = user;
  setSnapshot({ ids: [...snapshot.ids, recipeId] });
  if (supabase) {
    void supabase
      .from("favorite_recipes")
      .insert({ user_id: owner.id, recipe_id: recipeId })
      .then(({ error }) => {
        if (error) void syncFromDb();
      });
  }
}

export function removeFavorite(recipeId: number): void {
  if (!user || !snapshot.ids.includes(recipeId)) return;
  const owner = user;
  setSnapshot({ ids: snapshot.ids.filter((x) => x !== recipeId) });
  if (supabase) {
    void supabase
      .from("favorite_recipes")
      .delete()
      .eq("user_id", owner.id)
      .eq("recipe_id", recipeId)
      .then(({ error }) => {
        if (error) void syncFromDb();
      });
  }
}

export function toggleFavorite(recipeId: number): void {
  if (snapshot.ids.includes(recipeId)) removeFavorite(recipeId);
  else addFavorite(recipeId);
}