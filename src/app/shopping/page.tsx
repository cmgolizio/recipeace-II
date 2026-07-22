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
        <p className="opacity-70">
          {"Get these last ingredients, and you\'ll be good to go!"}
        </p>
      </div>

      {!ready ? (
        <p className="opacity-60">Loading…</p>
      ) : names.length === 0 ? (
        <p className="opacity-70">
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
                  className="text-sm opacity-60 hover:opacity-100"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearShopping}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/4 dark:border-white/20 dark:hover:bg-white/6"
          >
            Clear list
          </button>
        </>
      )}
    </div>
  );
}