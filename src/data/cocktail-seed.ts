/**
 * Recipeace — starter cocktail ingredient taxonomy (v1 seed data).
 * Sized to cover the ingredients for ~35 canonical cocktails.
 *
 * SEED ORDER (idempotent):
 *   1. Insert `ingredients`; resolve each `parent` (a name reference) to
 *      parent_id in a second pass.
 *   2. Insert `aliases`, resolving `ingredient` names to ids.
 *   3. Insert `substitutions`, resolving both names to ids.
 *   4. Insert `derivations`, resolving both names to ids.
 *   Upsert on ingredient `name` so the seed is safe to re-run.
 *
 * WHY THE HIERARCHY: owning a specific ingredient (e.g. bourbon) also satisfies
 * any recipe calling for its broader category (whiskey). The matcher expands a
 * pantry to each owned item PLUS its ancestors. Substitutions are looser
 * "in a pinch" swaps, surfaced as close matches rather than exact ones.
 *
 * `category` is the broad family bucket (for UI grouping/filtering);
 * `parent` is the immediate hierarchy edge. They are independent.
 */

export type Category =
  | "spirit"
  | "liqueur"
  | "fortified_wine"
  | "wine"
  | "bitters"
  | "mixer"
  | "juice"
  | "syrup"
  | "dairy"
  | "produce"
  | "garnish"
  | "other"
  | "staple";

export interface SeedIngredient {
  name: string;
  category: Category;
  parent?: string; // references another ingredient's `name`
  isStaple?: boolean;
}

export interface SeedAlias {
  alias: string;
  ingredient: string; // references an ingredient `name`
}

export interface SeedSubstitution {
  ingredient: string; // what the recipe calls for
  substitute: string; // what can stand in
  note?: string;
}

export interface SeedDerivation {
  source: string; // owning this ingredient…
  derived: string; // …physically yields this one (cut / juice / separate)
}

export const ingredients: SeedIngredient[] = [
  // ─── Spirits: whiskey ───
  { name: "whiskey", category: "spirit" },
  { name: "bourbon", category: "spirit", parent: "whiskey" },
  { name: "rye whiskey", category: "spirit", parent: "whiskey" },
  { name: "scotch", category: "spirit", parent: "whiskey" },
  { name: "islay scotch", category: "spirit", parent: "scotch" },
  { name: "irish whiskey", category: "spirit", parent: "whiskey" },

  // ─── Spirits: gin ───
  { name: "gin", category: "spirit" },
  { name: "london dry gin", category: "spirit", parent: "gin" },
  { name: "old tom gin", category: "spirit", parent: "gin" },
  { name: "plymouth gin", category: "spirit", parent: "gin" },

  // ─── Spirits: vodka ───
  { name: "vodka", category: "spirit" },

  // ─── Spirits: rum & cachaça ───
  { name: "rum", category: "spirit" },
  { name: "white rum", category: "spirit", parent: "rum" },
  { name: "gold rum", category: "spirit", parent: "rum" },
  { name: "dark rum", category: "spirit", parent: "rum" },
  { name: "aged rum", category: "spirit", parent: "rum" },
  { name: "spiced rum", category: "spirit", parent: "rum" },
  { name: "overproof rum", category: "spirit", parent: "rum" },
  { name: "cachaça", category: "spirit" },

  // ─── Spirits: agave ───
  { name: "tequila", category: "spirit" },
  { name: "blanco tequila", category: "spirit", parent: "tequila" },
  { name: "reposado tequila", category: "spirit", parent: "tequila" },
  { name: "añejo tequila", category: "spirit", parent: "tequila" },
  { name: "mezcal", category: "spirit" },

  // ─── Spirits: brandy ───
  { name: "brandy", category: "spirit" },
  { name: "cognac", category: "spirit", parent: "brandy" },
  { name: "armagnac", category: "spirit", parent: "brandy" },
  { name: "pisco", category: "spirit", parent: "brandy" },
  { name: "apple brandy", category: "spirit", parent: "brandy" },

  // ─── Spirits: anise ───
  { name: "absinthe", category: "spirit" },
  { name: "pastis", category: "spirit" },

  // ─── Liqueurs: orange ───
  { name: "orange liqueur", category: "liqueur" },
  { name: "triple sec", category: "liqueur", parent: "orange liqueur" },
  { name: "cointreau", category: "liqueur", parent: "orange liqueur" },
  { name: "grand marnier", category: "liqueur", parent: "orange liqueur" },
  { name: "orange curaçao", category: "liqueur", parent: "orange liqueur" },
  { name: "blue curaçao", category: "liqueur", parent: "orange liqueur" },

  // ─── Liqueurs: bitter (aperitivo / amaro) ───
  { name: "bitter liqueur", category: "liqueur" },
  { name: "campari", category: "liqueur", parent: "bitter liqueur" },
  { name: "aperol", category: "liqueur", parent: "bitter liqueur" },
  { name: "fernet branca", category: "liqueur", parent: "bitter liqueur" },
  { name: "averna", category: "liqueur", parent: "bitter liqueur" },
  { name: "cynar", category: "liqueur", parent: "bitter liqueur" },

  // ─── Liqueurs: herbal ───
  { name: "chartreuse", category: "liqueur" },
  { name: "green chartreuse", category: "liqueur", parent: "chartreuse" },
  { name: "yellow chartreuse", category: "liqueur", parent: "chartreuse" },
  { name: "bénédictine", category: "liqueur" },
  { name: "drambuie", category: "liqueur" },

  // ─── Liqueurs: fruit / nut / other ───
  { name: "maraschino liqueur", category: "liqueur" },
  { name: "amaretto", category: "liqueur" },
  { name: "coffee liqueur", category: "liqueur" },
  { name: "cream liqueur", category: "liqueur" },
  { name: "crème de cassis", category: "liqueur" },
  { name: "crème de mûre", category: "liqueur" },
  { name: "crème de menthe", category: "liqueur" },
  { name: "crème de cacao", category: "liqueur" },
  { name: "crème de violette", category: "liqueur" },
  { name: "elderflower liqueur", category: "liqueur" },
  { name: "falernum", category: "liqueur" },
  { name: "allspice dram", category: "liqueur" },
  { name: "peach schnapps", category: "liqueur" },
  { name: "melon liqueur", category: "liqueur" },
  { name: "sloe gin", category: "liqueur" },
  { name: "limoncello", category: "liqueur" },

  // ─── Fortified & aromatized wine ───
  { name: "vermouth", category: "fortified_wine" },
  { name: "sweet vermouth", category: "fortified_wine", parent: "vermouth" },
  { name: "dry vermouth", category: "fortified_wine", parent: "vermouth" },
  { name: "blanc vermouth", category: "fortified_wine", parent: "vermouth" },
  { name: "sherry", category: "fortified_wine" },
  { name: "fino sherry", category: "fortified_wine", parent: "sherry" },
  { name: "manzanilla sherry", category: "fortified_wine", parent: "sherry" },
  { name: "amontillado sherry", category: "fortified_wine", parent: "sherry" },
  { name: "oloroso sherry", category: "fortified_wine", parent: "sherry" },
  { name: "pedro ximénez sherry", category: "fortified_wine", parent: "sherry" },
  { name: "lillet blanc", category: "fortified_wine" },
  { name: "cocchi americano", category: "fortified_wine" },
  { name: "port", category: "fortified_wine" },

  // ─── Wine / sparkling ───
  { name: "sparkling wine", category: "wine" },
  { name: "champagne", category: "wine", parent: "sparkling wine" },
  { name: "prosecco", category: "wine", parent: "sparkling wine" },
  { name: "cava", category: "wine", parent: "sparkling wine" },
  { name: "red wine", category: "wine" },
  { name: "dry white wine", category: "wine" },

  // ─── Bitters ───
  { name: "bitters", category: "bitters" },
  { name: "angostura bitters", category: "bitters", parent: "bitters" },
  { name: "orange bitters", category: "bitters", parent: "bitters" },
  { name: "peychaud's bitters", category: "bitters", parent: "bitters" },
  { name: "chocolate bitters", category: "bitters", parent: "bitters" },

  // ─── Mixers ───
  { name: "soda water", category: "mixer" },
  { name: "tonic water", category: "mixer" },
  { name: "cola", category: "mixer" },
  { name: "ginger beer", category: "mixer" },
  { name: "ginger ale", category: "mixer" },
  { name: "lemon-lime soda", category: "mixer" },
  { name: "grapefruit soda", category: "mixer" },

  // ─── Juices ───
  { name: "lime juice", category: "juice" },
  { name: "lemon juice", category: "juice" },
  { name: "orange juice", category: "juice" },
  { name: "grapefruit juice", category: "juice" },
  { name: "pineapple juice", category: "juice" },
  { name: "cranberry juice", category: "juice" },
  { name: "tomato juice", category: "juice" },
  { name: "pomegranate juice", category: "juice" },

  // ─── Syrups ───
  { name: "simple syrup", category: "syrup" },
  { name: "rich simple syrup", category: "syrup" },
  { name: "demerara syrup", category: "syrup" },
  { name: "honey syrup", category: "syrup" },
  { name: "agave syrup", category: "syrup" },
  { name: "grenadine", category: "syrup" },
  { name: "orgeat", category: "syrup" },
  { name: "ginger syrup", category: "syrup" },
  { name: "passion fruit syrup", category: "syrup" },

  // ─── Dairy / egg ───
  { name: "egg white", category: "dairy" },
  { name: "whole egg", category: "dairy" },
  { name: "heavy cream", category: "dairy" },
  { name: "half-and-half", category: "dairy" },
  { name: "milk", category: "dairy" },

  // ─── Produce (muddled / fresh) ───
  { name: "lime", category: "produce" },
  { name: "lemon", category: "produce" },
  { name: "orange", category: "produce" },
  { name: "grapefruit", category: "produce" },
  { name: "fresh mint", category: "produce" },
  { name: "fresh basil", category: "produce" },
  { name: "cucumber", category: "produce" },
  { name: "fresh ginger", category: "produce" },
  { name: "strawberry", category: "produce" },
  { name: "raspberry", category: "produce" },
  { name: "blackberry", category: "produce" },
  { name: "jalapeño", category: "produce" },
  { name: "pineapple", category: "produce" },

  // ─── Garnish ───
  { name: "lime wedge", category: "garnish" },
  { name: "lime wheel", category: "garnish" },
  { name: "lemon wedge", category: "garnish" },
  { name: "lemon wheel", category: "garnish" },
  { name: "lemon twist", category: "garnish" },
  { name: "orange twist", category: "garnish" },
  { name: "orange slice", category: "garnish" },
  { name: "maraschino cherry", category: "garnish" },
  { name: "luxardo cherry", category: "garnish" },
  { name: "cocktail olive", category: "garnish" },
  { name: "cocktail onion", category: "garnish" },
  { name: "mint sprig", category: "garnish" },
  { name: "grated nutmeg", category: "garnish" },
  { name: "cinnamon stick", category: "garnish" },
  { name: "salt rim", category: "garnish" },
  { name: "sugar rim", category: "garnish" },
  { name: "celery stalk", category: "garnish" },
  { name: "coffee beans", category: "garnish" },

  // ─── Other ───
  { name: "cream of coconut", category: "other" },
  { name: "coffee", category: "other" },
  { name: "espresso", category: "other" },
  { name: "worcestershire sauce", category: "other" },
  { name: "hot sauce", category: "other" },
  { name: "sugar cube", category: "other" },
  { name: "aquafaba", category: "other" },

  // ─── Staples (assumed on hand) ───
  { name: "water", category: "staple", isStaple: true },
  { name: "ice", category: "staple", isStaple: true },
  { name: "crushed ice", category: "staple", parent: "ice", isStaple: true },
  { name: "sugar", category: "staple", isStaple: true },
  { name: "salt", category: "staple", isStaple: true },
];

export const aliases: SeedAlias[] = [
  // citrus juice
  { alias: "fresh lime juice", ingredient: "lime juice" },
  { alias: "lime juice (fresh)", ingredient: "lime juice" },
  { alias: "juice of 1 lime", ingredient: "lime juice" },
  { alias: "fresh lemon juice", ingredient: "lemon juice" },
  { alias: "juice of 1 lemon", ingredient: "lemon juice" },

  // soda
  { alias: "club soda", ingredient: "soda water" },
  { alias: "seltzer", ingredient: "soda water" },
  { alias: "sparkling water", ingredient: "soda water" },

  // tequila / rum
  { alias: "silver tequila", ingredient: "blanco tequila" },
  { alias: "white tequila", ingredient: "blanco tequila" },
  { alias: "anejo tequila", ingredient: "añejo tequila" },
  { alias: "light rum", ingredient: "white rum" },
  { alias: "silver rum", ingredient: "white rum" },
  { alias: "cachaca", ingredient: "cachaça" },

  // liqueurs (brand → canonical)
  { alias: "kahlua", ingredient: "coffee liqueur" },
  { alias: "kahlúa", ingredient: "coffee liqueur" },
  { alias: "tia maria", ingredient: "coffee liqueur" },
  { alias: "baileys", ingredient: "cream liqueur" },
  { alias: "irish cream", ingredient: "cream liqueur" },
  { alias: "st-germain", ingredient: "elderflower liqueur" },
  { alias: "st germain", ingredient: "elderflower liqueur" },
  { alias: "luxardo", ingredient: "maraschino liqueur" },
  { alias: "maraschino", ingredient: "maraschino liqueur" },
  { alias: "midori", ingredient: "melon liqueur" },
  { alias: "blackberry liqueur", ingredient: "crème de mûre" },
  { alias: "creme de mure", ingredient: "crème de mûre" },
  { alias: "blackcurrant liqueur", ingredient: "crème de cassis" },

  // vermouth
  { alias: "rosso vermouth", ingredient: "sweet vermouth" },
  { alias: "red vermouth", ingredient: "sweet vermouth" },
  { alias: "italian vermouth", ingredient: "sweet vermouth" },
  { alias: "french vermouth", ingredient: "dry vermouth" },
  { alias: "bianco vermouth", ingredient: "blanc vermouth" },
  { alias: "lillet", ingredient: "lillet blanc" },

  // syrups
  { alias: "pomegranate syrup", ingredient: "grenadine" },
  { alias: "almond syrup", ingredient: "orgeat" },
  { alias: "orgeat syrup", ingredient: "orgeat" },
  { alias: "rich syrup", ingredient: "rich simple syrup" },
  { alias: "simple syrup (1:1)", ingredient: "simple syrup" },

  // bitters
  { alias: "angostura", ingredient: "angostura bitters" },
  { alias: "aromatic bitters", ingredient: "angostura bitters" },
  { alias: "peychauds", ingredient: "peychaud's bitters" },

  // brandy / scotch
  { alias: "calvados", ingredient: "apple brandy" },
  { alias: "applejack", ingredient: "apple brandy" },
  { alias: "scotch whisky", ingredient: "scotch" },

  // other
  { alias: "coco lopez", ingredient: "cream of coconut" },
  { alias: "coconut cream", ingredient: "cream of coconut" },
  { alias: "tabasco", ingredient: "hot sauce" },
  { alias: "worcestershire", ingredient: "worcestershire sauce" },
  { alias: "brewed coffee", ingredient: "coffee" },
  { alias: "egg whites", ingredient: "egg white" },
  { alias: "champagne (brut)", ingredient: "champagne" },
];

// Looser "in a pinch" swaps. Treat as bidirectional in matching unless the
// note implies a one-way flavor shift; surface as close matches, not exact.
export const substitutions: SeedSubstitution[] = [
  { ingredient: "bourbon", substitute: "rye whiskey", note: "rye is spicier and drier; bourbon rounder and sweeter" },
  { ingredient: "cointreau", substitute: "triple sec", note: "generic triple sec is lower proof and less complex" },
  { ingredient: "cointreau", substitute: "grand marnier", note: "grand marnier is cognac-based, richer and sweeter" },
  { ingredient: "campari", substitute: "aperol", note: "aperol is lighter, sweeter, lower proof" },
  { ingredient: "lillet blanc", substitute: "cocchi americano", note: "cocchi is more bitter and quinine-forward" },
  { ingredient: "green chartreuse", substitute: "yellow chartreuse", note: "yellow is milder, sweeter, lower proof" },
  { ingredient: "cognac", substitute: "armagnac", note: "armagnac is more rustic and robust" },
  { ingredient: "lemon juice", substitute: "lime juice", note: "shifts the flavor profile; not identical" },
  { ingredient: "simple syrup", substitute: "demerara syrup", note: "demerara adds molasses depth and color" },
  { ingredient: "simple syrup", substitute: "honey syrup", note: "honey adds floral depth" },
  { ingredient: "white rum", substitute: "gold rum", note: "gold adds light barrel character" },
  { ingredient: "white rum", substitute: "cachaça", note: "cachaça is grassier and funkier" },
  { ingredient: "ginger beer", substitute: "ginger ale", note: "ginger ale is milder and sweeter" },
  { ingredient: "tequila", substitute: "mezcal", note: "mezcal adds smoke" },
  { ingredient: "maraschino cherry", substitute: "luxardo cherry", note: "luxardo are premium; maraschino brighter and sweeter" },
  { ingredient: "egg white", substitute: "aquafaba", note: "vegan substitute with the same foaming" },
  { ingredient: "absinthe", substitute: "pastis", note: "pastis (Herbsaint/Pernod) is sweeter and lower proof" },
  { ingredient: "orange curaçao", substitute: "triple sec", note: "close enough for most builds" },
  { ingredient: "scotch", substitute: "irish whiskey", note: "irish is lighter and smoother; loses peat character" },
];

// One-way physical derivations: owning `source` also counts as exactly having
// `derived` — anything you can get by cutting, juicing, or separating, with no
// real preparation (so no sugar → simple syrup). The matcher treats these as
// "have", not "close". Direction matters: owning a lemon twist does NOT grant
// a whole lemon.
export const derivations: SeedDerivation[] = [
  // whole citrus → its garnish cuts and fresh juice
  { source: "lemon", derived: "lemon wedge" },
  { source: "lemon", derived: "lemon wheel" },
  { source: "lemon", derived: "lemon twist" },
  { source: "lemon", derived: "lemon juice" },
  { source: "lime", derived: "lime wedge" },
  { source: "lime", derived: "lime wheel" },
  { source: "lime", derived: "lime juice" },
  { source: "orange", derived: "orange twist" },
  { source: "orange", derived: "orange slice" },
  { source: "orange", derived: "orange juice" },
  { source: "grapefruit", derived: "grapefruit juice" },

  // other fruit → juice (still just juicing)
  { source: "pineapple", derived: "pineapple juice" },

  // herbs & egg
  { source: "fresh mint", derived: "mint sprig" },
  { source: "whole egg", derived: "egg white" },

  // staples → rims (dip the glass; no preparation)
  { source: "salt", derived: "salt rim" },
  { source: "sugar", derived: "sugar rim" },
];