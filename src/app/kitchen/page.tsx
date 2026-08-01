import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Kitchen — In House Mixers",
  description:
    "Food recipes matched against the same pantry that powers the Bar. Being stocked now.",
  alternates: { canonical: "/kitchen" },
};

/**
 * Placeholder overview. The Kitchen catalog and matching arrive in later
 * phases; until they do this page says so plainly rather than linking to
 * routes that don't exist (docs/expansion-plan.md §29).
 */
export default function KitchenPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">The Kitchen</h1>
        <p className="text-muted">
          Food recipes, matched against the same pantry that powers the Bar.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Still being stocked</h2>
        <p className="mt-1 text-sm text-muted">
          There are no food recipes in the catalog yet. Nothing you add to your
          pantry is wasted in the meantime — it is one list, and it will count
          towards dinner as soon as the shelves are full.
        </p>
      </section>

      <p className="text-sm text-muted">
        In the meantime, your{" "}
        <Link href="/" className="underline hover:text-foreground">
          pantry
        </Link>{" "}
        is already matching drinks over in the{" "}
        <Link href="/bar" className="underline hover:text-foreground">
          Bar
        </Link>
        .
      </p>
    </div>
  );
}
