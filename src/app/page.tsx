import { IngredientBrowse } from "../components/ingredient-browse";
import { IngredientSearch } from "../components/ingredient-search";
import { PantryPanel } from "../components/pantry-panel";
import { StarterSuggestions } from "../components/starter-suggestions";
import { AuthMessage } from "../components/auth-message";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Build your bar</h1>
        {/* {!user ? (<p className="opacity-70">
          Add the cocktail ingredients you have InHome. Your bar stock will be saved temporarily. Sign in to save it permanently across all your devices!
        </p>)
        : (<p className="opacity-70">
          Add the cocktail ingredients you have InHome!
        </p>)} */}
        <AuthMessage />
      </div>
      <IngredientSearch />
      <StarterSuggestions />
      <IngredientBrowse />
      <PantryPanel />
    </div>
  );
}