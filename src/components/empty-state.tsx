import type { ReactNode } from "react";

// Small inline glyphs so empty states need no image assets. Stroke-based and
// currentColor, so they pick up the accent tint from the wrapper.
const ICONS = {
  glass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M4.5 5h15l-7.5 8.5z" />
      <path d="M12 13.5V19" />
      <path d="M8.5 19h7" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M12 20.5C8.2 17.2 3.5 13.8 3.5 9.6 3.5 7.2 5.4 5.5 7.7 5.5c1.7 0 3.2.9 4.3 2.4 1.1-1.5 2.6-2.4 4.3-2.4 2.3 0 4.2 1.7 4.2 4.1 0 4.2-4.7 7.6-8.5 10.9z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M8.5 6.5H20" />
      <path d="M8.5 12H20" />
      <path d="M8.5 17.5H20" />
      <path d="M4 6.5h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17.5h.01" />
    </svg>
  ),
};

/**
 * The one shared empty-state block: a glyph in an accent-tinted circle, a
 * short title, optional supporting copy, and an optional CTA slot. `titleAs`
 * lets a full-page use (the recipe 404) keep its h1.
 */
export function EmptyState({
  icon,
  title,
  titleAs: Title = "p",
  body,
  action,
}: {
  icon: keyof typeof ICONS;
  title: string;
  titleAs?: "h1" | "p";
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span
        aria-hidden
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent"
      >
        {ICONS[icon]}
      </span>
      <Title className="mt-4 font-semibold tracking-tight">{title}</Title>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The accent CTA used inside empty states (same treatment as the pantry CTA). */
export const emptyStateActionClass =
  "inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90";
