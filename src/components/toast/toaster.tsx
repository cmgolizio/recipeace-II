"use client";

import { useToasts } from "./store";

/**
 * Renders the active toasts bottom-anchored above all page content. Mounted
 * once in the root layout directly under <body>, so plain fixed positioning
 * needs no portal. The container always renders (empty when idle) so the
 * aria-live region exists before the first toast — screen readers announce
 * additions to an existing live region more reliably. The entrance animation
 * is gated behind motion-safe.
 */
export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium shadow-lg motion-safe:animate-[toast-in_150ms_ease-out]"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
