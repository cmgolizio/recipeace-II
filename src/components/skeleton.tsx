/**
 * The one shared skeleton primitive: a pulsing placeholder block, sized and
 * shaped by the caller (same visual language as app/recipes/loading.tsx).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-black/6 dark:bg-white/10 ${className}`}
    />
  );
}

/**
 * A recipe-card-shaped placeholder for client-side list fetches. `media`
 * reserves the image area for surfaces whose cards carry one (/favorites);
 * the matches cards are text-only, so they skip it.
 */
export function RecipeCardSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      {media && <Skeleton className="aspect-3/2 w-full rounded-none" />}
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
