"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../components/empty-state";
import { toast } from "../../components/toast/store";
import { DOMAIN_SURFACE } from "../../lib/recipes/domain";
import {
  clearShopping,
  removeFromShopping,
  useShoppingItems,
  useShoppingReady,
  type ShoppingItem,
} from "../../lib/shopping/store";

type Grouping = "flat" | "recipe";

/** Items under the recipe that sent you shopping, in first-added order. */
function byRecipe(
  items: ShoppingItem[],
): { title: string; hint: string | null; items: ShoppingItem[] }[] {
  const groups: {
    key: string;
    title: string;
    hint: string | null;
    items: ShoppingItem[];
  }[] = [];
  for (const item of items) {
    const key = item.from?.slug ?? "";
    const group = groups.find((g) => g.key === key);
    if (group) {
      group.items.push(item);
      continue;
    }
    groups.push({
      key,
      title: item.from?.name ?? "Added by hand",
      hint: item.from ? DOMAIN_SURFACE[item.from.domain] : null,
      items: [item],
    });
  }
  return groups;
}

function ItemRow({ item }: { item: ShoppingItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="font-medium">{item.name}</span>
        {item.from && (
          <>
            {" "}
            <Link
              href={`/recipes/${item.from.slug}`}
              className="text-sm text-muted underline decoration-border underline-offset-2 hover:text-foreground"
            >
              for {item.from.name}
            </Link>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          removeFromShopping(item.name);
          toast(`Removed ${item.name} from your list`);
        }}
        className="shrink-0 text-sm text-muted hover:text-foreground"
      >
        Remove
      </button>
    </li>
  );
}

export default function ShoppingPage() {
  const items = useShoppingItems();
  const ready = useShoppingReady();
  const [grouping, setGrouping] = useState<Grouping>("flat");

  const groups = byRecipe(items);
  // Grouping is only worth offering once there is something to group by.
  const canGroup = groups.length > 1;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-muted">
          The ingredients you’re missing — from the Bar and the Kitchen alike —
          saved for your next store run.
        </p>
      </div>

      {!ready ? (
        <p className="text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Nothing on your list"
          body="Add missing ingredients from your matches or any recipe page."
          action={
            <Link href="/bar/matches" className={emptyStateActionClass}>
              See your matches
            </Link>
          }
        />
      ) : (
        <>
          {canGroup && (
            <div
              role="group"
              aria-label="Group the list"
              className="inline-flex rounded-lg border border-border p-0.5 text-sm"
            >
              {(
                [
                  ["flat", "One list"],
                  ["recipe", "By recipe"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={grouping === value}
                  onClick={() => setGrouping(value)}
                  className={
                    grouping === value
                      ? "rounded-md bg-black/6 px-3 py-1 font-medium dark:bg-white/10"
                      : "rounded-md px-3 py-1 text-muted hover:text-foreground"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {grouping === "recipe" && canGroup ? (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.title}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    {group.title}
                    {group.hint && (
                      <span className="ml-2 font-normal normal-case opacity-70">
                        {group.hint}
                      </span>
                    )}
                  </h2>
                  <ul className="divide-y divide-black/5 dark:divide-white/10">
                    {group.items.map((item) => (
                      <ItemRow key={item.name} item={item} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {items.map((item) => (
                <ItemRow key={item.name} item={item} />
              ))}
            </ul>
          )}

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
