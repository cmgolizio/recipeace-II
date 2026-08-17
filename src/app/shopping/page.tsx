"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../components/empty-state";
import { toast } from "../../components/toast/store";
import { DOMAIN_SURFACE } from "../../lib/recipes/domain";
import { accentClass, accentFor, dealAccents } from "../../lib/theme/accents";
import { useAccentSeed } from "../../lib/theme/use-accent-seed";
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

// The <li> lives at the call site, because that is the element the dealer's
// .accent-* class goes on (D6) — and there are two call sites, flat and
// grouped, each of which deals over what it actually renders.
const rowClass =
  "flex items-center justify-between gap-3 border-l-4 border-l-accent py-2 pl-3";

function ItemRow({ item }: { item: ShoppingItem }) {
  return (
    <>
      <span className="min-w-0">
        <span className="font-medium">{item.name}</span>
        {item.from && (
          <>
            {" "}
            <Link
              href={`/recipes/${item.from.slug}`}
              className="text-sm text-muted underline decoration-accent-line underline-offset-2 hover:text-foreground"
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
    </>
  );
}

export default function ShoppingPage() {
  const items = useShoppingItems();
  const ready = useShoppingReady();
  const [grouping, setGrouping] = useState<Grouping>("flat");
  const accentSeed = useAccentSeed();

  const groups = byRecipe(items);
  // Grouping is only worth offering once there is something to group by.
  const canGroup = groups.length > 1;
  const flatAccents = dealAccents(items.map((item) => item.name), accentSeed);

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
                      ? "rounded-md bg-accent-tint px-3 py-1 font-medium text-foreground"
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
              {groups.map((group) => {
                const accents = dealAccents(
                  group.items.map((it) => it.name),
                  accentSeed,
                );
                return (
                <section
                  key={group.title}
                  className={accentClass(accentFor(group.title, accentSeed))}
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-ink">
                    {group.title}
                    {group.hint && (
                      <span className="ml-2 font-normal normal-case opacity-70">
                        {group.hint}
                      </span>
                    )}
                  </h2>
                  <ul className="divide-y divide-black/5 dark:divide-white/10">
                    {group.items.map((item, i) => (
                      <li
                        key={item.name}
                        className={`${rowClass} ${accentClass(accents[i])}`}
                      >
                        <ItemRow item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
                );
              })}
            </div>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {items.map((item, i) => (
                <li
                  key={item.name}
                  className={`${rowClass} ${accentClass(flatAccents[i])}`}
                >
                  <ItemRow item={item} />
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => {
              clearShopping();
              toast("Cleared your shopping list");
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent-line hover:bg-accent-tint"
          >
            Clear list
          </button>
        </>
      )}
    </div>
  );
}