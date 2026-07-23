"use client";

import { useSyncExternalStore } from "react";

/**
 * Three-state theme control: system → light → dark, persisted in a `theme`
 * cookie. The no-flash inline script in layout.tsx reads the same cookie
 * before first paint; this component keeps the <html> class in sync when
 * the user changes the setting. "system" clears both classes so the
 * prefers-color-scheme media query in globals.css applies (and tracks OS
 * changes live).
 */
const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const LABELS: Record<Theme, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

// Tiny cookie-backed store, same useSyncExternalStore shape as the pantry
// store: the server snapshot is null (the cookie isn't known during SSR) so
// hydration renders the neutral button, then the real value applies.
const listeners = new Set<() => void>();
let theme: Theme | null = null;

function readTheme(): Theme {
  const match = document.cookie.match(/(?:^|; )theme=(light|dark|system)/);
  return (match?.[1] as Theme) ?? "system";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  if (theme === null) theme = readTheme();
  return theme;
}

function getServerSnapshot(): Theme | null {
  return null;
}

function setTheme(next: Theme) {
  theme = next;
  document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  const classes = document.documentElement.classList;
  classes.remove("light", "dark");
  if (next !== "system") classes.add(next);
  for (const l of listeners) l();
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8m-4-4v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function cycle() {
    const current = theme ?? "system";
    setTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }

  const label = theme ? LABELS[theme] : "Theme";
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label} — click to change`}
      title={label}
      className="rounded-lg p-1.5 text-muted hover:text-foreground"
    >
      <ThemeIcon theme={theme ?? "system"} />
    </button>
  );
}
