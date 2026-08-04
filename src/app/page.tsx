import Link from "next/link";

import { AlmostThereNudge } from "../components/almost-there-nudge";
import { AuthMessage } from "../components/auth-message";
import { HomeHero } from "../components/home-hero";
import { IngredientBrowse } from "../components/ingredient-browse";
import { IngredientSearch } from "../components/ingredient-search";
import { PantryPanel } from "../components/pantry-panel";
import { StarterSuggestions } from "../components/starter-suggestions";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your pantry</h1>
        <p className="text-muted">
          One list of what you own. It answers both the{" "}
          <Link href="/bar" className="underline hover:text-foreground">
            Bar
          </Link>{" "}
          and the{" "}
          <Link href="/kitchen" className="underline hover:text-foreground">
            Kitchen
          </Link>{" "}
          — adding an ingredient here counts towards a drink and towards dinner.
        </p>
        <AuthMessage />
      </div>
      <HomeHero />
      <IngredientSearch />
      <StarterSuggestions />
      <IngredientBrowse />
      <PantryPanel />
      {/* Interim: the shared pantry can only nudge for one side here, and the
          Bar is the side with a catalog deep enough to be useful. */}
      <AlmostThereNudge domain="cocktail" />
    </div>
  );
}