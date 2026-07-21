"use client";

import { useEffect, useState } from "react";

/**
 * Share control for the recipe detail page: opens the native share sheet
 * where the browser has one, otherwise copies the canonical URL with a
 * transient "Copied" state.
 */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function share() {
    if (typeof navigator.share === "function") {
      // Rejects with AbortError when the user dismisses the sheet.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access denied — nothing useful to surface.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/[0.04] dark:border-white/20 dark:hover:bg-white/[0.06]"
    >
      {copied ? "✓ Copied" : "Share"}
    </button>
  );
}