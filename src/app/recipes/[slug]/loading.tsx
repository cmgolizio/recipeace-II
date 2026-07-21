export default function RecipeDetailLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-4 w-24 rounded bg-black/6 dark:bg-white/10" />

      <div className="aspect-square w-full max-w-xs rounded-xl bg-black/6 dark:bg-white/10" />

      <div className="space-y-2">
        <div className="h-8 w-1/2 rounded bg-black/6 dark:bg-white/10" />
        <div className="h-3 w-1/4 rounded bg-black/6 dark:bg-white/10" />
        <div className="h-5 w-4/5 rounded bg-black/6 dark:bg-white/10" />
      </div>

      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-black/6 dark:bg-white/10" />
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-5 w-3/5 rounded bg-black/6 dark:bg-white/10"
          />
        ))}
      </div>
    </div>
  );
}