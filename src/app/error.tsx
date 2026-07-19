"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-black/10 p-6 dark:border-white/15">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="opacity-70">{error.message}</p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:border-black/40 dark:border-white/20 dark:hover:border-white/50"
      >
        Try again
      </button>
    </div>
  );
}