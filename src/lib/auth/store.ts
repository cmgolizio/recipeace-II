"use client";

// The app's single auth-state source. The pantry and favorites stores each
// used to register their own supabase.auth.onAuthStateChange listener; they
// now register a reaction here instead, so exactly one subscription exists
// and every store reacts to the same event stream (and the same shared
// browser client).

import type { User } from "@supabase/supabase-js";

import { createClient } from "../supabase/client";

type AuthReaction = (user: User | null) => void;

let supabase: ReturnType<typeof createClient> | null = null;
let started = false;
// True once the first auth event has been dispatched, so a reaction that
// registers late is caught up immediately instead of waiting for the next
// event (the old per-store listeners each got their own INITIAL_SESSION).
let resolved = false;
let currentUser: User | null = null;
const reactions = new Set<AuthReaction>();

/** The shared browser Supabase client (created on first use). */
export function getSupabase(): ReturnType<typeof createClient> {
  if (!supabase) supabase = createClient();
  return supabase;
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // onAuthStateChange emits INITIAL_SESSION on registration (covering page
  // load) and SIGNED_IN / SIGNED_OUT later. Defer so we never call supabase
  // from within its own callback (avoids a known deadlock).
  getSupabase().auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    setTimeout(() => {
      resolved = true;
      currentUser = user;
      // Iterate a copy so a reaction registered mid-dispatch (which already
      // got the catch-up call below) is not invoked twice.
      for (const reaction of [...reactions]) reaction(user);
    }, 0);
  });
}

/**
 * Register a reaction to auth-user changes. Called with the current user
 * immediately when auth has already resolved, then on every auth event.
 */
export function onAuthUser(reaction: AuthReaction): void {
  start();
  reactions.add(reaction);
  if (resolved) reaction(currentUser);
}