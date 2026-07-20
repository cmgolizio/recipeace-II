"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  signOut,
  usePantry,
  usePantryReady,
  useUser,
} from "../lib/pantry/store";

export function SiteHeader() {
  const router = useRouter();
  const pantry = usePantry();
  const ready = usePantryReady();
  const user = useUser();

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-background/80 backdrop-blur dark:border-white/15">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          🍸 Recipeace
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="opacity-70 hover:opacity-100">
            My bar
          </Link>
          <Link href="/recipes" className="opacity-70 hover:opacity-100">
            Recipes
          </Link>
          <Link href="/matches" className="opacity-70 hover:opacity-100">
            Matches
          </Link>
          {user && (
            <Link href="/favorites" className="opacity-70 hover:opacity-100">
              Favorites
            </Link>
          )}
          <span
            className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs tabular-nums dark:bg-white/10"
            title={ready ? `${pantry.length} in your bar` : "Loading your bar"}
          >
            {ready ? pantry.length : "–"}
          </span>
          {user ? (
            <>
              <span className="hidden max-w-[12ch] truncate opacity-50 sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="opacity-70 hover:opacity-100"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="opacity-70 hover:opacity-100">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}