"use client";

import { MatchesView } from "../../../components/matches-view";

/**
 * The Bar's matches: the same matcher, ranking and shopping-list actions the
 * Kitchen uses, scoped to drinks (docs/expansion-plan.md §36).
 */
export default function BarMatchesPage() {
  return (
    <MatchesView
      copy={{
        domain: "cocktail",
        heading: "Bar matches",
        path: "/bar/matches",
        emptyPantry: "Your pantry is empty.",
        emptyCatalog: "No cocktails yet — check back soon.",
        unit: { singular: "drink", plural: "drinks" },
      }}
    />
  );
}
