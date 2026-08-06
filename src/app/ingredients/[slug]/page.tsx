import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { RecipeCard } from "../../../components/recipe-card";
import { matchPills, type RecipeDomain } from "../../../lib/recipes/domain";
import { SITE_NAME, pageTitle } from "../../../lib/site";
import { createStaticClient } from "../../../lib/supabase/static";
import type { Database } from "../../../types/database";

type Detail =
  Database["public"]["Functions"]["ingredient_detail"]["Returns"][number];

/** Shapes of the RPC's jsonb arrays. */
type UsedIn = {
  id: number;
  slug: string;
  name: string;
  domain: RecipeDomain;
  /** Domain-shaped card metadata; keys vary by domain, values are never null. */
  metadata: Record<string, string | number>;
  image_url: string | null;
};

type RelatedIngredient = { name: string; slug: string; note?: string | null };

type Props = { params: Promise<{ slug: string }> };

// Statically generated per ingredient and revalidated hourly, like the recipe
// pages — the taxonomy only changes when the seed is re-run.
export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createStaticClient();
  // Env-less build (e.g. CI): skip prerendering; slugs render on demand.
  if (!supabase) return [];
  const { data, error } = await supabase.from("ingredients").select("slug");
  if (error) throw new Error(`Couldn’t list ingredient slugs: ${error.message}`);
  return (data ?? []).map(({ slug }) => ({ slug }));
}

// Deduped across generateMetadata and the page render.
const getIngredient = cache(async (slug: string): Promise<Detail | null> => {
  const supabase = createStaticClient();
  if (!supabase) throw new Error("Supabase environment is not configured");
  const { data, error } = await supabase.rpc("ingredient_detail", {
    p_slug: slug,
  });
  if (error) throw new Error(`Couldn’t load this ingredient: ${error.message}`);
  return data?.[0] ?? null;
});

const categoryLabel = (category: Detail["category"]) =>
  category.replaceAll("_", " ");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ingredient = await getIngredient(slug);
  if (!ingredient) return {};
  const recipes = ingredient.recipes as unknown as UsedIn[];
  const title = pageTitle(ingredient.name);
  const description =
    recipes.length > 0
      ? `${recipes.length} recipe${recipes.length > 1 ? "s" : ""} made with ${ingredient.name}, plus what you can use instead.`
      : `${ingredient.name} — a ${categoryLabel(ingredient.category)} in the ${SITE_NAME} ingredient index.`;
  return {
    title,
    description,
    alternates: { canonical: `/ingredients/${slug}` },
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

/** A linked chip pointing at another ingredient's page. */
function IngredientChip({ name, slug }: { name: string; slug: string }) {
  return (
    <Link
      href={`/ingredients/${slug}`}
      className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm hover:border-accent"
    >
      {name}
    </Link>
  );
}

export default async function IngredientPage({ params }: Props) {
  const { slug } = await params;
  const ingredient = await getIngredient(slug);
  if (!ingredient) notFound();

  const recipes = ingredient.recipes as unknown as UsedIn[];
  const substitutes = ingredient.substitutes as unknown as RelatedIngredient[];
  const derives = ingredient.derives as unknown as RelatedIngredient[];

  return (
    <article className="space-y-8">
      <div>
        <Link
          href="/pantry"
          className="text-sm text-muted underline hover:text-foreground"
        >
          ← Your pantry
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ingredient.name}
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs capitalize text-muted">
            {categoryLabel(ingredient.category)}
          </span>
          {ingredient.is_staple && (
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted">
              always on hand
            </span>
          )}
        </div>
        {/* The category pill and the section heading below already carry the
            rest; this line only appears when there's something to add. */}
        {ingredient.is_staple ? (
          <p className="text-muted">
            Recipes assume you have this, so it never counts against a match.
          </p>
        ) : (
          recipes.length === 0 && (
            <p className="text-muted">
              Nothing in the catalog calls for this yet.
            </p>
          )
        )}
      </header>

      {recipes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Used in {recipes.length} recipe{recipes.length > 1 ? "s" : ""}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard
                  recipe={{
                    ...recipe,
                    pills: matchPills(recipe.domain, recipe.metadata),
                  }}
                  titleAs="h3"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {substitutes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Use instead
          </h2>
          <ul className="mt-3 space-y-2">
            {substitutes.map((sub) => (
              <li
                key={sub.slug}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <IngredientChip name={sub.name} slug={sub.slug} />
                {sub.note && <span className="text-sm text-muted">{sub.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {derives.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Owning this also gives you
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {derives.map((derived) => (
              <li key={derived.slug}>
                <IngredientChip name={derived.name} slug={derived.slug} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}