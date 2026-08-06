import Link from "next/link";

import {
  EmptyState,
  emptyStateActionClass,
} from "../../../components/empty-state";

export default function IngredientNotFound() {
  return (
    <EmptyState
      icon="list"
      title="Ingredient not found"
      titleAs="h1"
      body="There’s nothing in the index under that name — it may have been renamed or removed."
      action={
        <Link href="/pantry" className={emptyStateActionClass}>
          Browse ingredients
        </Link>
      }
    />
  );
}