import type { Metadata } from "next";
import Link from "next/link";

import { pageTitle } from "../../lib/site";
import { RecipeCard } from "../../components/recipe-card";
import { SearchForm } from "../../components/search-form";
import {
  matchPills,
  parseDomainFilter,
  RECIPE_DOMAINS,
  DOMAIN_SURFACE,
} from "../../lib/recipes/domain";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: pageTitle("Search"),
  description: "Search every recipe by name, description or ingredient.",
  alternates: { canonical: "/search" },
};

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = single(params.q);
  const domain = parseDomainFilter(single(params.domain));

  const supabase = await createClient();
  // One search over the whole catalog; the domain narrows it in the database.
  const { data, error } = q
    ? await supabase.rpc("search_recipes", {
        q,
        p_domain: domain === "all" ? null : domain,
        max_results: 50,
      })
    : { data: [], error: null };
  const results = data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted">
          Everything in the Bar and the Kitchen, by name or by ingredient.
        </p>
      </div>

      <SearchForm q={q} domain={domain} />

      {error && (
        <p className="text-red-600 dark:text-red-400">
          Couldn’t search: {error.message}
        </p>
      )}

      {q !== "" && !error && results.length === 0 && (
        <div className="space-y-2">
          <p className="text-muted">
            Nothing matches “{q}”
            {domain !== "all" && ` in the ${DOMAIN_SURFACE[domain]}`}.
          </p>
          {domain !== "all" && (
            <p className="text-sm text-muted">
              Try{" "}
              <Link
                href={{ pathname: "/search", query: { q } }}
                className="underline hover:text-foreground"
              >
                searching everything
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {q === "" && (
        <p className="text-muted">
          Start typing to search{" "}
          {RECIPE_DOMAINS.map((d) => DOMAIN_SURFACE[d].toLowerCase()).join(
            " and ",
          )}{" "}
          recipes.
        </p>
      )}

      {results.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <li key={r.recipe_id}>
              <RecipeCard
                recipe={{
                  id: r.recipe_id,
                  slug: r.slug,
                  name: r.name,
                  pills: [
                    DOMAIN_SURFACE[r.domain],
                    ...matchPills(r.domain, r.metadata),
                  ],
                  image_url: r.image_url,
                }}
                titleAs="h2"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
