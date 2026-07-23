import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Recipe not found
      </h1>
      <p className="text-muted">
        There’s no cocktail here — it may have been renamed or removed.
      </p>
      <p>
        <Link
          href="/recipes"
          className="text-sm text-muted underline hover:text-foreground"
        >
          ← Browse all recipes
        </Link>
      </p>
    </div>
  );
}