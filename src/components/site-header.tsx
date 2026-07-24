"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  signOut,
  usePantry,
  usePantryReady,
  useUser,
} from "../lib/pantry/store";
import { useShopping } from "../lib/shopping/store";
import { ThemeToggle } from "./theme-toggle";

function NavLink({
  href,
  exact = false,
  className = "",
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${
        active
          ? "text-foreground underline decoration-accent decoration-2 underline-offset-4"
          : "text-muted hover:text-foreground"
      } ${className}`}
    >
      {children}
    </Link>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2 hover:bg-black/4 dark:hover:bg-white/6"
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const router = useRouter();
  const pantry = usePantry();
  const ready = usePantryReady();
  const user = useUser();
  const shopping = useShopping();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menu links close themselves on click; any pointerdown outside the menu
  // (including the other nav links) or Escape also dismisses it.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <svg
            viewBox="0 0 512 512"
            className="h-5 w-5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={40}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M116 132h280L256 290z" />
            <path d="M256 290v104" />
            <path d="M172 394h168" />
          </svg>
          <span className="hidden min-[480px]:inline">In House Mixers</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <NavLink href="/" exact>
            my bar
          </NavLink>
          <NavLink href="/recipes">recipes</NavLink>
          <NavLink href="/matches">matches</NavLink>
          {user && (
            <NavLink href="/favorites" className="hidden sm:inline">
              favorites
            </NavLink>
          )}
          {shopping.length > 0 && (
            <NavLink href="/shopping" className="hidden sm:inline">
              shopping
            </NavLink>
          )}
          <span
            className="rounded-full bg-accent px-2.5 py-0.5 text-xs tabular-nums text-accent-foreground"
            title={ready ? `${pantry.length} in your bar` : "Loading your bar"}
          >
            {ready ? pantry.length : "–"}
          </span>
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden max-w-[12ch] truncate text-muted sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden text-muted hover:text-foreground sm:inline"
              >
                logout
              </button>
            </>
          ) : (
            <NavLink href="/login" className="hidden sm:inline">
              login
            </NavLink>
          )}
          <div ref={menuRef} className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="rounded-lg p-1.5 text-muted hover:text-foreground"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden
              >
                {menuOpen ? (
                  <path d="M5 5l14 14M19 5L5 19" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                {user ? (
                  <>
                    <MenuLink
                      href="/favorites"
                      onNavigate={() => setMenuOpen(false)}
                    >
                      favorites
                    </MenuLink>
                    {shopping.length > 0 && (
                      <MenuLink
                        href="/shopping"
                        onNavigate={() => setMenuOpen(false)}
                      >
                        shopping
                      </MenuLink>
                    )}
                    <div className="truncate px-3 py-2 text-xs text-muted">
                      {user.email}
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-black/4 dark:hover:bg-white/6"
                    >
                      logout
                    </button>
                  </>
                ) : (
                  <MenuLink href="/login" onNavigate={() => setMenuOpen(false)}>
                    login
                  </MenuLink>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}