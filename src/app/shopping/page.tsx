"use client";

import Link from "next/link";

import {
  clearShopping,
  removeFromShopping,
  useShopping,
  useShoppingReady,
} from "../../lib/shopping/store";

export default function ShoppingPage() {
  const names = useShopping();
  const ready = useShoppingReady();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-muted">
          {"Get these last ingredients, and you\'ll be good to go!"}
        </p>
      </div>

      {!ready ? (
        <p className="text-muted">Loading…</p>
      ) : names.length === 0 ? (
        <p className="text-muted">
          Your list is empty — add missing ingredients from{" "}
          <Link href="/matches" className="underline">
            your matches
          </Link>{" "}
          or any recipe page.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {names.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="font-medium">{name}</span>
                <button
                  type="button"
                  onClick={() => removeFromShopping(name)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearShopping}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/4 dark:hover:bg-white/6"
          >
            Clear list
          </button>
        </>
      )}
    </div>
  );
}