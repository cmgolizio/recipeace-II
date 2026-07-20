import { IngredientBrowse } from "../components/ingredient-browse";
import { IngredientSearch } from "../components/ingredient-search";
import { PantryPanel } from "../components/pantry-panel";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Build your bar</h1>
        <p className="opacity-70">
          Add the bottles, mixers, and garnishes you have on hand, no account
          needed. Your bar is saved in this browser. Then see every cocktail you
          can make.
        </p>
      </div>
      <IngredientSearch />
      <IngredientBrowse />
      <PantryPanel />
    </div>
  );
}