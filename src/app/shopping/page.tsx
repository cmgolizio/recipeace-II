"use client";

import Link from "next/link";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../components/empty-state";
import { toast } from "../../components/toast/store";
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
        <EmptyState
          icon="list"
          title="Nothing on your list"
          body="Add missing ingredients from your matches or any recipe page."
          action={
            <Link href="/matches" className={emptyStateActionClass}>
              See your matches
            </Link>
          }
        />
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
                  onClick={() => {
                    removeFromShopping(name);
                    toast(`Removed ${name} from your list`);
                  }}
                  className="text-sm text-muted hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearShopping();
              toast("Cleared your shopping list");
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/4 dark:hover:bg-white/6"
          >
            Clear list
          </button>
        </>
      )}
    </div>
  );
}