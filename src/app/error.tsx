"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted">{error.message}</p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-black/40 dark:hover:border-white/50"
      >
        Try again
      </button>
    </div>
  );
}