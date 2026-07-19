import Image from "next/image";
import Link from "next/link";

import { RecipesFilter } from "../../components/recipes-filter";
import { createClient } from "../../lib/supabase/server";
import type { Tables } from "../../types/database";

const PAGE_SIZE = 24;

type Recipe = Pick<
  Tables<"recipes">,
  "id" | "slug" | "name" | "description" | "method" | "glass" | "image_url"
>;

function pageHref(q: string, page: number) {
  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (page > 1) query.page = String(page);
  return { pathname: "/recipes", query };
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const qParam = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = qParam?.trim() ?? "";
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id,slug,name,description,method,glass,image_url", {
      count: "exact",
    })
    .order("name")
    .range(from, from + PAGE_SIZE - 1);
  if (q) {
    // The pattern is double-quoted because PostgREST's or= list treats , ( )
    // specially; backslash-escape the quote/backslash chars inside it.
    const pattern = `%${q.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}%`;
    query = query.or(`name.ilike."${pattern}",description.ilike."${pattern}"`);
  }
  const { data, count, error } = await query;

  const recipes: Recipe[] = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <p className="opacity-70">
          Browse the catalog. Open any cocktail to see the full build and what
          you’re missing from your bar.
        </p>
      </div>

      <RecipesFilter initialQuery={q} />

      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t load recipes: {error.message}
        </p>
      )}
      {!error && total === 0 && q === "" && (
        <p className="opacity-60">
          No recipes in the database yet. Run{" "}
          <code className="rounded bg-black/[0.06] px-1 dark:bg-white/10">
            supabase/seed_test_recipes.sql
          </code>{" "}
          to add some.
        </p>
      )}
      {!error && q !== "" && recipes.length === 0 && (
        <p className="opacity-60">No recipes match “{q}”.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.slug}`}
              className="block h-full overflow-hidden rounded-xl border border-black/10 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              {r.image_url && (
                <div className="relative aspect-[3/2] w-full">
                  <Image
                    src={r.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 360px, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold">{r.name}</h2>
                {(r.method || r.glass) && (
                  <p className="mt-0.5 text-xs uppercase tracking-wide opacity-50">
                    {[r.method, r.glass].filter(Boolean).join(" · ")}
                  </p>
                )}
                {r.description && (
                  <p className="mt-2 text-sm opacity-70">{r.description}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(q, page - 1)}
              className="opacity-70 hover:opacity-100"
            >
              ← Previous
            </Link>
          ) : (
            <span aria-hidden className="opacity-30">
              ← Previous
            </span>
          )}
          <span className="opacity-60">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(q, page + 1)}
              className="opacity-70 hover:opacity-100"
            >
              Next →
            </Link>
          ) : (
            <span aria-hidden className="opacity-30">
              Next →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}