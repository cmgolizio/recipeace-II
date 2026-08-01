"use client";

import { MatchesView } from "../../../components/matches-view";

/**
 * The Kitchen's matches. Identical machinery to the Bar's — one matcher, one
 * pantry, one ranking — pointed at the food domain.
 */
export default function KitchenMatchesPage() {
  return (
    <MatchesView
      copy={{
        domain: "food",
        heading: "Kitchen matches",
        path: "/kitchen/matches",
        emptyPantry: "Your pantry is empty.",
        emptyCatalog: "No food recipes yet — the Kitchen is still being stocked.",
        unit: { singular: "dish", plural: "dishes" },
      }}
    />
  );
}
