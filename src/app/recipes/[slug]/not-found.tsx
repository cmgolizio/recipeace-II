import Link from "next/link";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../../components/empty-state";

export default function RecipeNotFound() {
  return (
    <EmptyState
      icon="glass"
      title="Recipe not found"
      titleAs="h1"
      body="There’s no cocktail here — it may have been renamed or removed."
      action={
        <Link href="/recipes" className={emptyStateActionClass}>
          Browse all recipes
        </Link>
      }
    />
  );
}