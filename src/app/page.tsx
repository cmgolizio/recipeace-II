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
        <h1 className="text-2xl font-semibold tracking-tight">Build your bar</h1>
        <AuthMessage />
      </div>
      <HomeHero />
      <IngredientSearch />
      <StarterSuggestions />
      <IngredientBrowse />
      <PantryPanel />
      <AlmostThereNudge />
    </div>
  );
}
