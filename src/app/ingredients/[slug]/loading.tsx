export default function IngredientLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      <div className="h-4 w-28 rounded bg-black/6 dark:bg-white/10" />

      <div className="space-y-2">
        <div className="h-8 w-1/2 rounded bg-black/6 dark:bg-white/10" />
        <div className="h-5 w-20 rounded-full bg-black/6 dark:bg-white/10" />
        <div className="h-5 w-3/5 rounded bg-black/6 dark:bg-white/10" />
      </div>

      <div className="space-y-3">
        <div className="h-4 w-36 rounded bg-black/6 dark:bg-white/10" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <div className="aspect-3/2 w-full bg-black/6 dark:bg-white/10" />
              <div className="space-y-2 p-4">
                <div className="h-5 w-2/5 rounded bg-black/6 dark:bg-white/10" />
                <div className="h-3 w-1/4 rounded bg-black/6 dark:bg-white/10" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}