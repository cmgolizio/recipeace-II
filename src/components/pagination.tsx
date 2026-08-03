import Link from "next/link";
import type { UrlObject } from "url";

/**
 * Previous / next for a paginated catalog. Both domains page the same way, so
 * the markup lives here and each catalog supplies its own href builder.
 * Renders nothing for a single page.
 */
export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => UrlObject;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between text-sm"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-muted hover:text-foreground">
          ← Previous
        </Link>
      ) : (
        <span aria-hidden className="opacity-30">
          ← Previous
        </span>
      )}
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="text-muted hover:text-foreground">
          Next →
        </Link>
      ) : (
        <span aria-hidden className="opacity-30">
          Next →
        </span>
      )}
    </nav>
  );
}