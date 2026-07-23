"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  signOut,
  usePantry,
  usePantryReady,
  useUser,
} from "../lib/pantry/store";
import { useShopping } from "../lib/shopping/store";

export function SiteHeader() {
  const router = useRouter();
  const pantry = usePantry();
  const ready = usePantryReady();
  const user = useUser();
  const shopping = useShopping();

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-accent">
          🍸 InHouseMixers
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-foreground">
            my bar
          </Link>
          <Link href="/recipes" className="text-muted hover:text-foreground">
            recipes
          </Link>
          <Link href="/matches" className="text-muted hover:text-foreground">
            matches
          </Link>
          {user && (
            <Link href="/favorites" className="text-muted hover:text-foreground">
              favorites
            </Link>
          )}
          {shopping.length > 0 && (
            <Link href="/shopping" className="text-muted hover:text-foreground">
              shopping
            </Link>
          )}
          <span
            className="rounded-full bg-accent px-2.5 py-0.5 text-xs tabular-nums text-accent-foreground"
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
                className="text-muted hover:text-foreground"
              >
                logout
              </button>
            </>
          ) : (
            <Link href="/login" className="text-muted hover:text-foreground">
              login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}