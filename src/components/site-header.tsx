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
import { SITE_NAME } from "../lib/site";
import { accentClass, accentFor, dealAccents } from "../lib/theme/accents";
import { useAccentSeed } from "../lib/theme/use-accent-seed";
import { DomainSwitcher } from "./domain-switcher";
import { ThemeToggle } from "./theme-toggle";

/**
 * Every link carries its dealt accent, so the active one cannot be identified
 * by hue (D3). Three neutral signals mark it instead — weight, a switch to
 * --foreground, and the accent underline — none of which depend on seeing
 * colour, and none of which change the link's box, so navigating never
 * reflows the nav.
 */
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
          ? "font-semibold text-foreground underline decoration-accent-line decoration-2 underline-offset-4"
          : "text-accent-ink hover:text-foreground"
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
      className="block rounded-lg px-3 py-2 hover:bg-accent-tint"
    >
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const router = useRouter();
  // The header outlives every client-side navigation, so a mount-scoped seed
  // would freeze it for the session. Keyed on the path, it re-deals on each
  // navigation like every other surface.
  const accentSeed = useAccentSeed(usePathname());
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

  const pantryLabel = ready
    ? `${pantry.length} ingredient${pantry.length === 1 ? "" : "s"} in your pantry`
    : "Loading your pantry";

  // The nav's own list, dealt as one so neighbouring links never repeat. Login
  // sits past the badge and the theme toggle rather than in this run, so it is
  // a neighbourless accentFor instead.
  const navLinks = [
    { href: "/search", label: "find a recipe" },
    { href: "/pantry", label: "pantry" },
    ...(user ? [{ href: "/favorites", label: "favorites" }] : []),
    ...(shopping.length > 0 ? [{ href: "/shopping", label: "shopping" }] : []),
  ];
  const navAccents = dealAccents(
    navLinks.map((link) => link.href),
    accentSeed,
  );

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <svg
            viewBox="0 0 512 512"
            className="h-5 w-5 text-accent-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth={36}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {/* Fork and glass: the Kitchen and the Bar, one mark. */}
            <path d="M120 116v84M170 116v84M220 116v84" />
            <path d="M120 200h100" />
            <path d="M170 200v196" />
            <path d="M292 140h136l-68 92z" />
            <path d="M360 232v128" />
            <path d="M316 396h88" />
          </svg>
          <span className="hidden min-[480px]:inline">{SITE_NAME}</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <DomainSwitcher />
          {navLinks.map((link, i) => (
            // The wrapper carries the class; NavLink itself gains no prop (D6).
            // `hidden sm:inline` moves here so the span never opens a gap of
            // its own in the flex row on small screens.
            <span
              key={link.href}
              className={`hidden sm:inline ${accentClass(navAccents[i])}`}
            >
              <NavLink href={link.href}>{link.label}</NavLink>
            </span>
          ))}
          <span
            className="rounded-full bg-accent px-2.5 py-0.5 text-xs tabular-nums text-accent-foreground"
            // `title` alone is not an accessible name on a span: a screen
            // reader would announce the bare number with no context.
            aria-label={pantryLabel}
            title={pantryLabel}
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
            <span
              className={`hidden sm:inline ${accentClass(accentFor("/login", accentSeed))}`}
            >
              <NavLink href="/login">login</NavLink>
            </span>
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
                {/* The same run of links, so the same deal — the menu is the
                    small-screen form of the nav, not a second list. */}
                {navLinks.map((link, i) => (
                  <div key={link.href} className={accentClass(navAccents[i])}>
                    <MenuLink
                      href={link.href}
                      onNavigate={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </MenuLink>
                  </div>
                ))}
                {user ? (
                  <>
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
                  <div className={accentClass(accentFor("/login", accentSeed))}>
                    <MenuLink
                      href="/login"
                      onNavigate={() => setMenuOpen(false)}
                    >
                      login
                    </MenuLink>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}