import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Recipe not found
      </h1>
      <p className="opacity-70">
        There’s no cocktail here — it may have been renamed or removed.
      </p>
      <p>
        <Link
          href="/recipes"
          className="text-sm underline opacity-60 hover:opacity-100"
        >
          ← Browse all recipes
        </Link>
      </p>
    </div>
  );
}