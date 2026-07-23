export default function RecipesLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="space-y-2">
        <div className="h-8 w-32 rounded bg-black/6 dark:bg-white/10" />
        <div className="h-5 w-full max-w-md rounded bg-black/6 dark:bg-white/10" />
      </div>

      <div className="space-y-2">
        <div className="h-11 w-full rounded-lg bg-black/6 dark:bg-white/10" />
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-lg bg-black/6 dark:bg-white/10" />
          <div className="h-8 w-28 rounded-lg bg-black/6 dark:bg-white/10" />
          <div className="h-8 w-28 rounded-lg bg-black/6 dark:bg-white/10" />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <div className="aspect-3/2 w-full bg-black/6 dark:bg-white/10" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-2/5 rounded bg-black/6 dark:bg-white/10" />
              <div className="h-3 w-1/4 rounded bg-black/6 dark:bg-white/10" />
              <div className="h-4 w-4/5 rounded bg-black/6 dark:bg-white/10" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}