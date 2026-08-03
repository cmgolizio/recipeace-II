# RecipeAce Expansion Plan

> **File:** `docs/expansion-plan.md`
> **Purpose:** This document is the authoritative implementation plan for expanding RecipeAce from a cocktail-focused application into a unified food-and-drink recipe platform.
>
> Every AI coding session working on this expansion must read this entire file before proposing or making changes.

---

# 1. How AI Must Use This Document

This file defines the intended architecture, implementation order, constraints, and completion criteria for the RecipeAce expansion.

Before making changes, AI must:

1. Read this entire document.
2. Inspect the current repository rather than assuming this document perfectly reflects the latest implementation.
3. Read the existing project planning documents:
   - `docs/build-plan.md`
   - `docs/polish-plan.md`
   - `docs/polish-plan2.md`
4. Inspect all files directly involved in the requested phase.
5. Determine which phases are already complete, partially complete, or not started.
6. Work on only the phase or subphase requested by the user.
7. Preserve all existing working cocktail functionality unless the current phase explicitly changes it.
8. Avoid large, unrelated refactors.
9. Update this document when implementation decisions materially change.
10. Run the appropriate validation checks before claiming a phase is complete.

AI must not:

- Build a second independent application for food.
- Create a separate Supabase project for food.
- Create a separate Postgres schema for food.
- Duplicate the ingredient system.
- Duplicate the pantry system.
- Duplicate the matching engine.
- Duplicate favorites or shopping-list systems.
- Add `domain` columns to every recipe-related table.
- Treat food and cocktails as entirely separate products internally.
- Begin future phases before the current phase passes its completion criteria.
- Replace working systems merely to make them more abstract.
- Introduce premature package extraction or monorepo complexity without a demonstrated need.
- Combine food and cocktail AI prompts into one oversized prompt.
- Silently change database behavior, matching rules, or existing routes without documenting the change.

When ambiguity exists, AI should prefer:

1. The smallest change.
2. Shared systems.
3. Explicit data modeling.
4. Backward compatibility.
5. Database integrity.
6. Server-side enforcement.
7. Incremental migration.
8. Inspectable behavior over hidden magic.

---

# 2. Project Goal

RecipeAce currently helps users identify cocktail recipes they can make, or nearly make, using ingredients they already have.

The expansion will add food recipes while preserving the same core product idea:

> Users maintain one pantry and RecipeAce tells them what food and drink recipes they can make, what they are close to making, and what ingredients they need.

The expanded product should feel like one application with two primary experiences:

- **Bar**
- **Kitchen**

These are product surfaces, not separate technical systems.

The expansion must produce:

- One user account.
- One ingredient catalog.
- One pantry.
- One recipe system.
- One matching engine.
- One favorites system.
- One shopping list.
- One Supabase project.
- One Next.js application.
- Domain-aware food and cocktail experiences.

---

# 3. Final Architecture Summary

The target architecture is:

One Next.js application
One Supabase project
One primary application schema
One shared ingredient catalog
One shared pantry
One shared recipe table
One shared recipe-ingredient relationship
One shared matcher
One shared favorites system
One shared shopping list
One shared recipe-detail route
One recipe domain column stored only on recipes
Separate domain-specific metadata only where structurally necessary
Separate Bar and Kitchen routes and interfaces
Separate food and cocktail ingestion adapters

The most important architectural rule is:

> **Recipe domain is persisted only on the `recipes` table. Related records inherit domain through their relationship to a recipe.**

Example:

recipes.domain = "cocktail" | "food"

The following tables must not duplicate the recipe domain merely for convenience:

- Recipe ingredients.
- Recipe instructions.
- Recipe images.
- Favorites.
- Shopping-list recipe references.
- Recipe tags.
- Recipe aliases.
- Recipe source records.
- Recipe detail tables.

Those records can determine domain by joining to `recipes`.

A domain field may exist in user-interface or user-preference records when it represents a filter or preference rather than content classification.

Examples that may legitimately contain a domain preference:

user_preferences.default_domain
saved_searches.domain_filter
homepage_sections.domain_filter

---

# 4. Core Product Principles

## 4.1 One Pantry

A user must not maintain separate food and cocktail pantries.

The pantry represents what the user owns, regardless of whether an ingredient is used in food, cocktails, or both.

Examples of cross-domain ingredients include:

- Lime juice.
- Lemon juice.
- Mint.
- Sugar.
- Salt.
- Cream.
- Milk.
- Coffee.
- Cinnamon.
- Honey.
- Ginger.
- Orange.
- Soda water.
- Bitters.
- Eggs.

A single canonical ingredient record should be usable by recipes in either domain.

---

## 4.2 One Ingredient Graph

The existing ingredient architecture is one of the most valuable parts of RecipeAce and must be expanded rather than replaced.

The shared ingredient graph includes concepts such as:

- Canonical ingredients.
- Aliases.
- Normalized names.
- Substitutions.
- Derivations.
- Ingredient ownership.
- Recipe requirements.

Food must integrate with this same graph.

Do not create:

food_ingredients
cocktail_ingredients
food_ingredient_aliases
cocktail_ingredient_aliases

Instead, extend the shared ingredient catalog and classification system.

---

## 4.3 One Matching Engine

Food and cocktail recipes must use one generalized matching engine.

The engine may apply domain-specific policy through configuration, but it must not become two unrelated implementations.

Conceptually:

js
matchRecipes({
pantry,
domain: "food",
filters,
});

and:

js
matchRecipes({
pantry,
domain: "cocktail",
filters,
});

Both calls should use the same core matching logic.

---

## 4.4 Domain-Aware Interfaces

The user-facing product should provide distinct Bar and Kitchen experiences because the two domains require different browsing language, filters, presentation, and expectations.

Recommended routes:

/bar
/bar/pantry
/bar/matches
/bar/recipes

/kitchen
/kitchen/pantry
/kitchen/matches
/kitchen/recipes

/recipes/[slug]
/ingredients/[slug]
/favorites
/shopping-list
/settings

The exact final route set may evolve after inspection of the existing application.

The important rule is:

> Bar and Kitchen are interface contexts over shared data, not separate applications.

---

## 4.5 Preserve Existing Cocktail Behavior

The expansion must not degrade current cocktail functionality.

Before changing shared systems, establish baseline behavior for:

- Pantry management.
- Recipe matching.
- Recipe detail pages.
- Favorites.
- Shopping-list actions.
- Filtering.
- Substitutions.
- Derivations.
- Authentication.
- Mobile layouts.
- Empty states.
- Loading states.

Shared refactors must prove that existing cocktail results remain correct.

---

# 5. Definitions

## 5.1 Domain

A recipe’s primary product category.

Initial allowed values:

cocktail
food

Use a constrained database type or constraint rather than uncontrolled free text.

Future values must not be added speculatively.

Do not initially add domains such as:

dessert
mocktail
snack
breakfast
baking

Those concepts should initially be represented through categories, tags, courses, meal types, or alcoholic/nonalcoholic metadata.

---

## 5.2 Recipe

A set of ingredients and instructions that produces a food or drink item.

The shared recipe entity should contain only fields that apply broadly across recipe domains.

Likely shared fields include:

- ID.
- Slug.
- Name.
- Summary.
- Description.
- Domain.
- Image information.
- Source information.
- Status.
- Publication state.
- Timestamps.

The exact list must be based on the current schema.

---

## 5.3 Domain-Specific Recipe Details

Metadata that applies only to one recipe domain.

Examples for cocktails:

- Glassware.
- Garnish.
- Shake, stir, or build method.
- Alcoholic status.
- Approximate strength.
- Cocktail family.

Examples for food:

- Prep time.
- Cook time.
- Total time.
- Servings.
- Course.
- Cuisine.
- Difficulty.
- Cooking methods.

Domain-specific details should be separated only where they are genuinely structurally different.

Do not create separate full recipe tables.

---

## 5.4 Pantry Match

A comparison between a user’s pantry and a recipe’s requirements.

The engine should identify, at minimum:

- Recipes the user can make.
- Recipes the user is close to making.
- Missing required ingredients.
- Requirements satisfied through substitutions.
- Requirements satisfied through derivations.
- Optional ingredients not owned.

Later phases may add:

- Equipment requirements.
- Preparation effort.
- Time limits.
- Dietary restrictions.
- Ingredient quantities.
- Staple assumptions.

---

# 6. Non-Goals for the Initial Expansion

The initial expansion does not require:

- A separate food application.
- A monorepo.
- A separate shared-engine package.
- A separate Supabase project.
- A separate Postgres schema.
- Meal planning.
- Nutrition calculations.
- Calorie tracking.
- Grocery delivery integration.
- Social feeds.
- User-submitted public recipes.
- Comments.
- Ratings.
- Automatic portion scaling.
- Complete dietary certification.
- Advanced quantity-aware pantry depletion.
- Restaurant inventory management.
- AI-generated recipes as the primary food catalog.
- Native mobile applications.
- Complete redesign of the cocktail experience.

These features may be considered later, but they must not expand the first implementation unnecessarily.

---

# 7. Repository Organization Strategy

## 7.1 Remain a Single Application

Keep RecipeAce as one Next.js application.

Do not create a monorepo solely because the application now supports two recipe domains.

A monorepo should only be considered later if the project develops genuinely separate deployable applications, such as:

- A public web app.
- An internal editorial application.
- A standalone worker service.
- A separately deployed API.
- A mobile application.
- A distinct ingestion service.

Until then, use clear internal module boundaries.

---

## 7.2 Do Not Prematurely Extract a Shared Package

The matching engine and recipe logic should be modular, but they do not initially need to become a separately versioned package.

Recommended internal organization:

src/
app/
components/
features/
bar/
kitchen/
pantry/
recipes/
matching/
favorites/
shopping-list/
lib/
ingredients/
recipes/
matching/
pantry/
substitutions/
derivations/
server/
queries/
mutations/
services/

The exact folder structure should respect the current project organization.

The goal is separation of responsibility, not restructuring for its own sake.

---

## 7.3 Domain Adapters

Domain-specific behavior should be represented through explicit adapters or configuration where useful.

Conceptually:

recipes/
core/
domains/
cocktail/
food/

`

Possible domain-specific responsibilities:

- Filters.
- Labels.
- Detail presentation.
- Metadata validation.
- Ingestion prompts.
- Ingestion schemas.
- Category mappings.
- Instruction validation.

Shared responsibilities should remain in core modules.

---

# 8. Database Target Model

The exact migration must be based on the existing database, but the final design should follow these principles.

---

## 8.1 Recipes Table

Add a constrained `domain` field to the existing recipes table.

Conceptual SQL:

sql
create type recipe_domain as enum ('cocktail', 'food');

alter table recipes
add column domain recipe_domain;
`

Migration must not immediately make the field required before existing rows are backfilled.

Safe sequence:

1. Create the domain type or check constraint.
2. Add the nullable column.
3. Backfill all existing recipes as `cocktail`.
4. Verify no recipes remain without a domain.
5. Add `NOT NULL`.
6. Add an appropriate default only if it is safe and intentional.
7. Add indexes required by domain-filtered queries.

Do not rely permanently on a default that could cause new food recipes to be silently classified as cocktails.

Prefer requiring ingestion and creation paths to specify the domain explicitly.

---

## 8.2 Shared Recipe Data

Continue using one recipes table for generic fields.

Do not create:

food_recipes
cocktail_recipes

Do not duplicate generic fields between domain tables.

---

## 8.3 Recipe Detail Tables

Inspect the current cocktail-specific fields.

For each field, classify it as:

1. Generic.
2. Cocktail-specific.
3. Food-specific.
4. Obsolete.
5. Derived.

If cocktail-specific fields currently live directly on `recipes`, decide whether they can remain temporarily or should move to a cocktail detail table.

Potential target:

recipes
cocktail_recipe_details
food_recipe_details

Conceptual relationships:

recipes.id -> cocktail_recipe_details.recipe_id
recipes.id -> food_recipe_details.recipe_id

Each detail table should have at most one row per recipe.

Database constraints should prevent:

- Two cocktail detail rows for one recipe.
- Two food detail rows for one recipe.
- Orphan detail rows.

Application validation must ensure:

- Cocktail recipes use cocktail metadata.
- Food recipes use food metadata.

Database-level enforcement may be added where practical without creating brittle cross-table triggers.

---

## 8.4 Recipe Ingredients

Continue using the shared recipe-ingredient relationship.

Do not add a domain column.

Food may require additional relationship metadata, such as:

- Quantity.
- Unit.
- Preparation note.
- Optional status.
- Section.
- Display order.
- Substitution policy.

Before adding fields, inspect what already exists.

A food ingredient requirement may conceptually include:

2 large eggs, separated

This contains several distinct concerns:

- Canonical ingredient: egg.
- Quantity: 2.
- Unit: count.
- Preparation note: separated.
- Display text or structured modifier: large.
- Required versus optional.

Do not force every phrase into the canonical ingredient name.

---

## 8.5 Instructions

Determine whether instructions are currently:

- Stored as a JSON array.
- Stored as text.
- Stored in a separate table.
- Embedded in generated content.

The final system should support ordered instructions for both domains.

Food recipes may require:

- More steps.
- Sections.
- Timing notes.
- Temperatures.
- Concurrent actions.

Avoid overengineering the first implementation.

The first food version only needs reliable ordered steps.

---

## 8.6 Ingredients

Retain one shared ingredients table.

Review the existing ingredient category implementation.

If categories are represented by a cocktail-specific enum, it will likely become restrictive for food.

Potential transition:

ingredient_categories
ingredient_category_assignments

or:

ingredients.primary_category_id
ingredient_categories

Choose the simplest model that supports the actual product requirements.

Do not create a massive taxonomy in the first migration.

Initial food categories may include:

- Produce.
- Meat.
- Seafood.
- Dairy.
- Eggs.
- Grains.
- Pasta.
- Bread.
- Canned goods.
- Legumes.
- Oils and fats.
- Herbs.
- Spices.
- Condiments.
- Sauces.
- Baking.
- Sweeteners.
- Beverages.
- Alcohol.

Existing cocktail categories must remain usable.

An ingredient may eventually belong to multiple categories, but only implement multi-category support if the user interface or matching logic requires it.

---

## 8.7 Aliases

Continue using one alias system.

Food expansion will require substantial alias coverage.

Examples:

scallions -> green onion
caster sugar -> superfine sugar
confectioners sugar -> powdered sugar
garbanzo beans -> chickpeas
aubergine -> eggplant
courgette -> zucchini
coriander leaves -> cilantro

Aliases should map language variations to one canonical ingredient without creating duplicate canonical records.

Be careful with regional names that may be ambiguous.

---

## 8.8 Substitutions

Continue using the existing shared substitution system.

Food substitutions are more context-sensitive than many cocktail substitutions.

A substitution should not automatically mean universal equivalence.

Potential future metadata:

- Directionality.
- Equivalence quality.
- Domain restrictions.
- Recipe restrictions.
- Quantity conversion.
- Dietary implications.
- Preparation requirements.

For the initial food release, use only high-confidence substitutions.

Examples that may be acceptable in some contexts:

shallot -> onion
Greek yogurt -> sour cream
lime juice -> lemon juice
vegetable stock -> chicken stock

However, the system must avoid presenting context-sensitive substitutions as universally valid.

The substitution system should eventually distinguish:

- Broadly interchangeable.
- Acceptable with flavor change.
- Emergency substitute.
- Recipe-author-approved substitute.

Do not attempt to solve all substitution complexity in the MVP.

---

## 8.9 Derivations

Continue using the shared derivation system, but audit its assumptions.

Cocktail derivations may treat one owned ingredient as allowing another ingredient to be produced.

Food creates much broader derivation possibilities:

whole garlic -> minced garlic
lemon -> lemon juice
butter + flour -> roux
milk + acid -> buttermilk substitute
bread -> breadcrumbs

Not all transformations should be considered automatically available.

A derivation may require:

- Equipment.
- Time.
- Skill.
- Multiple ingredients.
- Cooking.
- Advance preparation.

Initial rule:

> Only include straightforward, near-zero-burden derivations that users would reasonably expect the matcher to recognize.

Do not count complex preparations as automatically available during the first food release.

---

## 8.10 Favorites

Use one favorites system.

Favorites should reference recipes without duplicating domain.

The interface may filter favorites by domain by joining to recipes.

Desired behavior:

All Favorites
Food Favorites
Cocktail Favorites

Do not create separate food and cocktail favorite tables.

---

## 8.11 Shopping List

Use one shopping list.

Shopping-list items may come from either domain.

The list should eventually allow filtering or grouping by:

- Recipe.
- Domain.
- Ingredient category.
- Manually added versus recipe-derived item.

Do not create separate food and bar shopping lists unless the product later demonstrates a clear user need.

---

## 8.12 Row-Level Security

All database migrations must preserve or correctly extend Supabase Row-Level Security.

Review policies for:

- Pantry records.
- Favorites.
- Shopping-list items.
- User preferences.
- Saved searches.
- Any new user-owned tables.

Public recipe catalog tables may remain publicly readable if that matches the existing application model.

Never assume a new table is secure merely because it exists in Supabase.

For every new table, explicitly decide:

- Is RLS enabled?
- Who may select?
- Who may insert?
- Who may update?
- Who may delete?
- Are writes performed by users, server code, or service-role ingestion?

---

## 8.13 Generated Types

After schema changes:

1. Regenerate database types.
2. Update affected query code.
3. Remove temporary casts.
4. Ensure new domain values are represented correctly.
5. Verify no stale generated types remain committed.

Do not manually edit generated Supabase type files unless the project explicitly treats them as handwritten.

---

# 9. Routing and Navigation Target

The final product should expose Bar and Kitchen as obvious top-level destinations.

Potential navigation:

Home
Bar
Kitchen
Pantry
Favorites
Shopping List

A domain switcher may also be used.

The experience should answer:

- Where am I?
- Am I browsing drinks or food?
- Does my pantry apply to both?
- How do I switch domains?
- Where do I see everything?

---

## 9.1 Home Page

The expanded home page should introduce the unified concept rather than presenting RecipeAce as cocktail-only.

Potential sections:

- What can I make?
- Kitchen matches.
- Bar matches.
- Recently added recipes.
- Pantry progress.
- Recipes missing one ingredient.
- Continue browsing.

The first release does not need every section.

The home page should not require loading the entire recipe catalog.

---

## 9.2 Bar Routes

Bar routes should preserve the existing cocktail experience as closely as practical.

Suggested responsibilities:

/bar

Bar overview, featured drinks, pantry match summary, and entry points.

/bar/matches

Cocktail matches filtered by `recipes.domain = 'cocktail'`.

/bar/recipes

Cocktail browsing and filters.

/bar/pantry

Optional domain-aware pantry presentation while editing the same shared pantry.

The project may keep existing routes during migration and add redirects later.

---

## 9.3 Kitchen Routes

Suggested responsibilities:

/kitchen

Kitchen overview and food-focused entry point.

/kitchen/matches

Food recipe matches filtered by `recipes.domain = 'food'`.

/kitchen/recipes

Food recipe catalog and food-specific filters.

/kitchen/pantry

Optional kitchen-focused view of the same shared pantry.

---

## 9.4 Shared Recipe Detail Route

Use one recipe detail route where possible:

/recipes/[slug]

The page should read the recipe domain and render the correct detail components.

Conceptual rendering:

js
if (recipe.domain === "cocktail") {
return <CocktailRecipeDetails recipe={recipe} />;
}

if (recipe.domain === "food") {
return <FoodRecipeDetails recipe={recipe} />;
}

Shared elements may include:

- Title.
- Image.
- Summary.
- Ingredient list.
- Pantry availability.
- Missing ingredients.
- Favorite control.
- Shopping-list control.
- Instructions.
- Source attribution.

Domain-specific elements may include:

Cocktail:

- Glassware.
- Garnish.
- Method.
- Drink family.

Food:

- Prep time.
- Cook time.
- Servings.
- Cuisine.
- Course.

---

## 9.5 Ingredient Detail Route

Retain one shared ingredient route:

/ingredients/[slug]

`

An ingredient page may show:

- Recipes using the ingredient.
- Food recipes.
- Cocktail recipes.
- Aliases.
- Substitutions.
- Derivations.
- Pantry status.

Do not create separate food and cocktail ingredient URLs for the same canonical ingredient.

---

# 10. Query and Data-Access Strategy

All recipe-fetching code must become domain-aware without duplicating entire query layers.

Preferred pattern:

js
getRecipes({
domain,
filters,
pagination,
sort,
});
`

Avoid:

js
getFoodRecipes();
getCocktailRecipes();

when both functions would contain almost identical query code.

Small wrappers are acceptable:

js
function getFoodRecipes(options) {
return getRecipes({
...options,
domain: "food",
});
}

The underlying implementation should remain shared.

Queries should explicitly select the fields they use.

Avoid broad `select("*")` calls in important application paths when domain-specific joins could create unnecessary payloads or ambiguity.

---

## 10.1 Domain Filtering

Domain filtering should happen as early as practical:

- In database queries.
- In matching RPC arguments.
- In server-side services.

Do not fetch every recipe and filter domain only in the browser.

---

## 10.2 Pagination

Food expansion will increase catalog size.

Recipe browsing must support scalable pagination.

Choose the existing project pattern unless it is clearly inadequate.

Possible approaches:

- Offset pagination for simple catalogs.
- Cursor pagination for larger or frequently changing lists.

Do not load the entire food and cocktail catalog into one client component.

---

## 10.3 Query Consistency

Create one consistent representation for recipe preview data.

Potential preview object:

js
{
id,
slug,
name,
summary,
domain,
image,
matchStatus,
missingIngredientCount,
missingIngredients,
metadataPreview,
}

Do not force every recipe card to load full instructions and every ingredient relationship.

---

# 11. Matching Engine Target

The existing matching engine should be generalized in controlled steps.

---

## 11.1 Required Inputs

The generalized matcher should accept:

js
{
userId,
domain,
filters,
limit,
cursor,
}

The exact API may differ.

Domain should be explicit.

Avoid hidden reliance on the current route to determine domain inside low-level matcher logic.

---

## 11.2 Core Match Rules

For each recipe, determine:

- Required ingredients.
- Optional ingredients.
- Directly owned ingredients.
- Alias-resolved ownership.
- Substitution-resolved ownership.
- Derivation-resolved ownership.
- Missing required ingredients.

Initial ranking can continue to emphasize:

1. Makeable recipes.
2. Recipes missing one ingredient.
3. Recipes missing two ingredients.
4. Recipes missing more ingredients.

Preserve existing cocktail ranking behavior unless intentionally changed and tested.

---

## 11.3 Ingredient Optionality

Food recipes frequently contain optional ingredients such as garnish or serving suggestions.

Optional ingredients must not make a recipe appear unavailable.

The recipe-ingredient model must clearly distinguish:

required
optional

If existing cocktail data lacks explicit optionality, establish a safe default.

---

## 11.4 Pantry Staples

Food matching raises the issue of pantry staples:

- Salt.
- Pepper.
- Water.
- Neutral oil.
- Sugar.
- Flour.

Do not silently assume that every user owns every staple without a product decision.

Initial options:

1. Require all ingredients to be present.
2. Mark certain ingredients as assumed staples.
3. Let users configure assumed staples.
4. Exclude simple staples from missing counts while still displaying them.

Recommended phased approach:

- Initial MVP: use a small, explicit staple policy.
- Make the policy visible in the interface.
- Later allow user configuration.

The policy must be deterministic and documented.

---

## 11.5 Quantities

The existing matcher may be based primarily on ingredient presence.

For the first food release, presence-based matching is acceptable.

Do not block the expansion on full pantry quantity tracking.

The user may own an ingredient even if the system cannot verify that they own enough.

The interface should not imply exact quantity sufficiency unless quantity-aware matching is implemented.

Use language such as:

You have all listed ingredients

rather than:

You have enough of every ingredient

---

## 11.6 Equipment

Food recipes may require:

- Oven.
- Blender.
- Mixer.
- Food processor.
- Grill.
- Slow cooker.
- Pressure cooker.

Equipment-aware matching is valuable but is not required for the first food MVP.

The data model should avoid making future equipment support impossible.

Do not add equipment matching before the basic food recipe experience works.

---

## 11.7 Time and Difficulty

Food recipe filters should eventually support:

- Preparation time.
- Cooking time.
- Total time.
- Difficulty.

These values should initially affect browsing and filtering, not core ingredient availability.

Later ranking may consider both ingredient closeness and preparation burden.

---

## 11.8 Dietary Filtering

Dietary filters require trustworthy metadata.

Potential filters:

- Vegetarian.
- Vegan.
- Gluten-free.
- Dairy-free.
- Nut-free.

Do not infer safety-critical dietary labels casually from incomplete ingredient data.

For the MVP:

- Include only labels that are explicitly stored or confidently validated.
- Clearly distinguish preference filters from allergy guarantees.
- Do not claim a recipe is allergy-safe without appropriate review.

---

# 12. Search Strategy

Search should work across both domains while supporting domain filtering.

Searchable recipe fields may include:

- Name.
- Aliases.
- Summary.
- Ingredient names.
- Cuisine.
- Course.
- Cocktail family.
- Tags.

Search should support:

All
Food
Cocktails

The first implementation may use existing Postgres search capabilities.

Do not introduce an external search service unless current performance or relevance clearly requires one.

---

# 13. Filter Strategy

## 13.1 Shared Filters

Potential shared filters:

- Makeable now.
- Missing one ingredient.
- Favorites.
- Recently added.
- Ingredient inclusion.
- Ingredient exclusion.

---

## 13.2 Cocktail Filters

Potential cocktail-specific filters:

- Base spirit.
- Cocktail family.
- Preparation method.
- Glassware.
- Alcoholic or nonalcoholic.
- Flavor profile.

Preserve existing filters where possible.

---

## 13.3 Food Filters

Initial food filters should remain manageable.

Recommended first set:

- Course.
- Cuisine.
- Total time.
- Difficulty.
- Dietary tags.
- Main ingredient.
- Makeable status.

Do not launch with dozens of unreliable filters.

---

# 14. Component Architecture

Components should be shared when they represent the same responsibility and separated when the two domains genuinely need different presentation.

---

## 14.1 Shared Components

Likely shared:

- Recipe card shell.
- Recipe image.
- Favorite button.
- Shopping-list button.
- Pantry availability indicator.
- Missing ingredient display.
- Ingredient list.
- Ingredient link.
- Recipe search input.
- Pagination.
- Empty states.
- Loading skeletons.
- Error states.
- Domain badge.
- Match-status badge.

---

## 14.2 Domain-Specific Components

Likely domain-specific:

CocktailRecipeMetadata
FoodRecipeMetadata
CocktailRecipeInstructions
FoodRecipeInstructions
CocktailFilters
FoodFilters
CocktailRecipeCardDetails
FoodRecipeCardDetails

`

Do not force both domains into one component with numerous conditional branches if their presentation becomes substantially different.

Avoid components like:

jsx
<RecipeCard
  isFood={...}
  isCocktail={...}
  showGlassware={...}
  showCookTime={...}
  showCuisine={...}
/>
`

Prefer composition:

jsx
<RecipeCard>
<RecipeCardHeader />
<RecipeAvailability />
<FoodRecipeCardMetadata />
</RecipeCard>

---

## 14.3 Server and Client Boundaries

Continue favoring server-rendered data and small client islands.

Server responsibilities:

- Database reads.
- Domain filtering.
- Matching calls.
- Initial filter results.
- Metadata construction.

Client responsibilities:

- Interactive filter controls.
- Optimistic favorite actions.
- Shopping-list actions.
- Pantry controls.
- Domain-switcher interactions.
- Client-only state.

Do not move broad data fetching to the client merely because food routes are new.

---

# 15. Content and Recipe Acquisition Strategy

Food recipe quality is a major product risk.

The first food catalog should prioritize trustworthy structured content.

Preferred sources:

- Original recipes.
- Properly licensed recipe datasets.
- Public-domain recipe sources.
- Partner-provided content.
- Manually curated recipes with appropriate attribution.

Do not copy protected recipe text from websites without permission.

Ingredient lists and basic factual instructions may have limited protectability in some contexts, but the application must still avoid copying expressive descriptions, headnotes, and instruction wording from copyrighted sources.

Source and licensing decisions must be recorded.

---

## 15.1 AI Usage

AI should initially assist with:

- Ingredient normalization.
- Alias suggestions.
- Category assignment.
- Metadata enrichment.
- Cuisine or course tagging.
- Instruction cleanup.
- Validation.
- Duplicate detection.
- Structured conversion.
- Summary drafting for owned or licensed recipes.

AI should not initially be treated as the authoritative source of the food catalog.

Do not fill the production database with a large volume of unreviewed AI-generated recipes.

---

## 15.2 Initial Catalog Size

Recommended food MVP:

- 10–15 complete food recipes during schema and UI development.
- 25–50 recipes for internal validation.
- 50–100 reviewed recipes for an initial meaningful public launch.

The exact launch number may change.

Quality and ingredient coverage are more important than raw count.

---

## 15.3 Catalog Composition

The initial catalog should intentionally cover common pantry combinations.

Suggested distribution:

- Simple breakfasts.
- Sandwiches.
- Salads.
- Pasta.
- Rice dishes.
- Soups.
- Sheet-pan meals.
- Chicken dishes.
- Vegetarian mains.
- Basic desserts.
- Sauces and dressings.

Avoid beginning with recipes that depend on rare specialty ingredients.

---

# 16. Ingestion Pipeline Target

The existing offline generation or ingestion pipeline should be preserved and generalized.

Target organization:

scripts/
pipeline/
core/
load-source
normalize
validate
deduplicate
persist
report
domains/
cocktail/
schema
prompts
transforms
validators
food/
schema
prompts
transforms
validators

Use the current repository’s actual structure where possible.

The goal is a shared pipeline lifecycle with separate domain adapters.

---

## 16.1 Shared Pipeline Responsibilities

Shared pipeline code should handle:

- File reading.
- Job configuration.
- Retries.
- Logging.
- Structured-output parsing.
- Normalization orchestration.
- Database writes.
- Dry runs.
- Validation reports.
- Duplicate detection.
- Failure reports.
- Idempotency.

---

## 16.2 Cocktail Adapter

The cocktail adapter should preserve existing cocktail generation and validation behavior.

Changes should be limited to making domain assumptions explicit.

Every created cocktail recipe must set:

domain = cocktail

---

## 16.3 Food Adapter

The food adapter should define its own:

- Source schema.
- Output schema.
- Prompts.
- Ingredient-normalization behavior.
- Metadata rules.
- Instruction validation.
- Duplicate checks.
- Domain-specific fields.

Every created food recipe must set:

domain = food

---

## 16.4 Pipeline Validation

Food recipe validation should check:

- Recipe name exists.
- Domain is food.
- Ingredients exist.
- Ingredient quantities are valid.
- Units are recognized or intentionally freeform.
- Instructions are ordered.
- Instructions reference plausible ingredients.
- Times are nonnegative.
- Servings are plausible.
- Required metadata exists.
- No duplicate slug exists.
- No likely duplicate recipe exists.
- All canonical ingredient references resolve.
- Source information is recorded.
- Publication status is correct.

Validation failures should not silently insert partial recipes.

---

## 16.5 Dry Run

The food pipeline must support a dry-run mode before production insertion.

Dry-run output should include:

- Proposed recipe.
- Normalized ingredients.
- Newly proposed canonical ingredients.
- Alias mappings.
- Unresolved ingredients.
- Substitutions or derivations referenced.
- Warnings.
- Duplicate candidates.
- Expected database operations.

---

## 16.6 Idempotency

Running the same ingestion job twice must not create duplicate recipes, ingredients, aliases, or relationships.

Use stable source identifiers, slugs, hashes, or explicit import keys.

The exact strategy should be documented in the pipeline code.

---

# 17. Analytics and Observability

The expansion should be measurable.

Potential events:

- Domain viewed.
- Domain switched.
- Recipe viewed.
- Recipe favorited.
- Recipe added to shopping list.
- Match result opened.
- Pantry ingredient added.
- Pantry ingredient removed.
- Filter applied.
- Search submitted.
- No-results state reached.

Do not block the initial implementation on a full analytics platform.

At minimum, ensure application errors and pipeline failures are inspectable.

Track domain in analytics event properties rather than creating separate unrelated event names for every food and cocktail action.

Prefer:

recipe_viewed { domain: "food" }
recipe_viewed { domain: "cocktail" }

over:

food_recipe_viewed
cocktail_recipe_viewed

unless the analytics system requires otherwise.

---

# 18. Accessibility Requirements

New Kitchen interfaces must meet the same accessibility standards as the rest of the application.

Requirements include:

- Semantic headings.
- Keyboard-accessible controls.
- Visible focus states.
- Labeled form controls.
- Meaningful image alt text.
- Sufficient contrast.
- Accessible loading states.
- Accessible error messages.
- No color-only status communication.
- Correct button-versus-link semantics.
- Screen-reader-readable domain context.
- Reduced-motion support where applicable.

Domain switchers should behave as navigation, tabs, or segmented controls according to their actual function.

---

# 19. Performance Requirements

The food expansion will increase data volume and component complexity.

Protect performance by:

- Filtering by domain in the database.
- Paginating recipe lists.
- Selecting only required columns.
- Avoiding per-card database requests.
- Batching relationship queries.
- Using appropriate indexes.
- Preserving server rendering.
- Limiting client JavaScript.
- Optimizing images.
- Avoiding duplicate query execution.
- Preventing N+1 ingredient lookups.
- Caching stable public catalog data where appropriate.

Measure before introducing complex caching.

---

# 20. SEO and Metadata

Food and cocktail recipe pages should use domain-aware metadata.

Potential metadata:

- Page title.
- Description.
- Canonical URL.
- Open Graph image.
- Recipe domain.
- Structured recipe information.

Do not add structured-data claims that are unsupported.

Food recipe schema markup may eventually include:

- Prep time.
- Cook time.
- Total time.
- Yield.
- Ingredients.
- Instructions.

Cocktail pages may also fit broader recipe structured data.

Validate generated metadata before launch.

---

# 21. Error Handling

The expanded application must handle:

- Invalid domain values.
- Missing detail records.
- Incomplete recipes.
- Unavailable images.
- Unknown ingredients.
- Failed matching queries.
- Failed favorites actions.
- Failed shopping-list actions.
- Failed pipeline jobs.
- Missing route parameters.
- Stale slugs.
- Recipes with unsupported metadata.

Never crash the entire route because one optional metadata field is absent.

Invalid database states should be logged and surfaced clearly during development.

---

# 22. Testing Strategy

Testing must be added incrementally throughout the phases.

---

## 22.1 Baseline Tests

Before shared refactors, establish tests for existing cocktail behavior.

At minimum:

- Cocktail recipes are returned by cocktail queries.
- Cocktail recipes match correctly against pantry ingredients.
- Missing ingredients are counted correctly.
- Favorites work.
- Shopping-list actions work.
- Recipe detail pages render.

---

## 22.2 Database Tests

Test:

- Existing recipes backfill to cocktail.
- New recipes require a valid domain.
- Invalid domains fail.
- Food recipes can be inserted.
- Detail-table uniqueness is enforced.
- Foreign keys prevent orphan records.
- RLS still protects user-owned data.
- Domain is not duplicated where prohibited.

---

## 22.3 Matcher Tests

Create fixtures covering:

- Exact food match.
- Exact cocktail match.
- One missing food ingredient.
- One missing cocktail ingredient.
- Optional ingredients.
- Aliases.
- Substitutions.
- Derivations.
- Shared ingredients used across both domains.
- Domain filtering.
- Staple behavior.
- Recipes with identical ingredient sets across different domains.

---

## 22.4 Query Tests

Test:

- Food queries return only food.
- Cocktail queries return only cocktails.
- All-domain queries return both.
- Pagination remains stable.
- Filters apply within domain.
- Search respects domain.
- Shared ingredient pages show both domains.

---

## 22.5 UI Tests

Test:

- Domain navigation.
- Kitchen recipe lists.
- Bar recipe lists.
- Recipe-detail branching.
- Favorites filtering.
- Shared pantry behavior.
- Mobile layouts.
- Empty states.
- Loading states.
- Error states.

---

## 22.6 Pipeline Tests

Test:

- Food source parsing.
- Cocktail source parsing.
- Normalization.
- Duplicate prevention.
- Dry-run behavior.
- Domain assignment.
- Validation failures.
- Unresolved ingredients.
- Idempotent reruns.

---

## 22.7 Regression Tests

Every major shared-system phase must rerun cocktail regression tests.

A phase is not complete merely because food works.

Both domains must work.

---

# 23. Migration and Rollout Strategy

Use additive migrations before destructive cleanup.

Preferred sequence:

1. Add new structures.
2. Backfill current data.
3. Update reads.
4. Update writes.
5. Verify production behavior.
6. Remove obsolete structures only after no code depends on them.

Do not combine all schema changes into one irreversible migration.

Each migration should have a focused purpose.

Before destructive changes:

- Identify dependent queries.
- Identify pipeline writes.
- Identify generated types.
- Identify RLS policies.
- Identify database functions.
- Identify indexes.
- Identify production-data assumptions.

---

# 24. Phase Overview

The expansion is divided into bite-sized phases so it can be completed over multiple AI prompts.

Each phase has:

- Objective.
- Required inspection.
- Implementation tasks.
- Tests.
- Completion criteria.
- Explicit non-goals.

Do not skip phases unless repository inspection proves the work is already complete.

Recommended sequence:

Phase 0 — Establish baseline and expansion inventory
Phase 1 — Add recipe domain safely
Phase 2 — Make recipe queries domain-aware
Phase 3 — Generalize matching by domain
Phase 4 — Introduce Bar and Kitchen application structure
Phase 5 — Normalize shared and domain-specific recipe metadata
Phase 6 — Expand the ingredient taxonomy
Phase 7 — Make recipe ingredients food-ready
Phase 8 — Build the food ingestion adapter
Phase 9 — Seed the first curated food catalog
Phase 10 — Build Kitchen recipe browsing
Phase 11 — Build Kitchen matching
Phase 12 — Integrate shared pantry, favorites, and shopping list
Phase 13 — Unify recipe detail pages
Phase 14 — Expand search, filters, and discovery
Phase 15 — Rebrand and polish the unified product
Phase 16 — Performance, security, accessibility, and regression review
Phase 17 — Production rollout and cleanup
Phase 18 — Post-MVP enhancements

---

# 25. Phase 0 — Establish Baseline and Expansion Inventory

## Objective

Understand the current application completely enough to make safe changes.

No major feature implementation should occur in this phase.

## Required Inspection

Read:

- Existing planning documents.
- Database migrations.
- Generated database types.
- Recipe queries.
- Pantry queries.
- Matcher implementation.
- Recipe pages.
- Recipe cards.
- Favorites code.
- Shopping-list code.
- Ingredient normalization code.
- Substitution code.
- Derivation code.
- Ingestion pipeline.
- Authentication and RLS policies.
- Test configuration.
- Deployment configuration.

## Tasks

Create an expansion inventory documenting:

1. Current recipe schema.
2. Current ingredient schema.
3. Current cocktail-specific fields.
4. Current matching algorithm.
5. Current route map.
6. Current query entry points.
7. Current pipeline flow.
8. Current user-owned tables.
9. Current RLS policies.
10. Current tests.
11. Current assumptions that food will violate.
12. Current technical debt relevant to the expansion.

Classify code into:

- Reusable unchanged.
- Reusable with generalization.
- Cocktail-specific.
- Obsolete.
- Unknown.

Record baseline behavior for important cocktail flows.

## Deliverables

- Repository inventory.
- Current architecture summary.
- List of files likely affected by each phase.
- Identified migration risks.
- List of baseline tests to add.

## Completion Criteria

- All core systems have been inspected.
- Cocktail-specific assumptions are explicitly identified.
- No unresolved uncertainty remains about where domain filtering must be added.
- Baseline application behavior is documented.

## Non-Goals

- No new food routes.
- No food recipes.
- No broad folder restructuring.
- No database migration beyond optional test support.

---

# 26. Phase 1 — Add Recipe Domain Safely

## Objective

Add the authoritative recipe domain classification without breaking existing cocktail data.

## Required Inspection

Inspect:

- Recipes table.
- All recipe insert paths.
- All recipe update paths.
- Seed scripts.
- Pipeline writes.
- Database functions.
- Generated types.
- Test fixtures.

## Tasks

1. Add a constrained recipe domain type.
2. Add a nullable domain column.
3. Backfill existing recipes as cocktail.
4. Verify every recipe has a domain.
5. Make domain required.
6. Add an index for domain-filtered queries.
7. Update recipe insertion code to require domain.
8. Update cocktail pipeline writes to explicitly set cocktail.
9. Regenerate database types.
10. Add domain to recipe fixtures.
11. Document the migration.

## Important Constraint

Domain must exist only on `recipes` as content classification.

Do not add domain to:

- Recipe ingredients.
- Favorites.
- Instructions.
- Images.
- Shopping-list relationships.

## Tests

- Existing recipes become cocktail.
- Food is accepted.
- Cocktail is accepted.
- Invalid domains fail.
- Null domain fails after migration.
- New cocktail inserts explicitly set domain.

## Completion Criteria

- Every recipe has a valid domain.
- Existing cocktail behavior is unchanged.
- All recipe creation paths explicitly supply domain.
- Generated types compile.
- No duplicate domain columns have been introduced.

## Non-Goals

- No Kitchen routes.
- No food metadata table.
- No food recipe ingestion.
- No matcher changes beyond necessary type compatibility.

---

# 27. Phase 2 — Make Recipe Queries Domain-Aware

## Objective

Ensure all recipe data-access paths can filter by domain.

## Required Inspection

Find every query that:

- Lists recipes.
- Searches recipes.
- Loads recipe cards.
- Retrieves featured recipes.
- Retrieves favorites.
- Retrieves ingredient-related recipes.
- Retrieves match candidates.

## Tasks

1. Introduce a shared domain type in application code.
2. Add optional or required domain parameters to shared query functions.
3. Apply domain filtering at the database level.
4. Add explicit all-domain behavior where needed.
5. Update recipe preview types.
6. Ensure favorites can be filtered through recipe joins.
7. Ensure ingredient pages can request one domain or both.
8. Remove client-only domain filtering.
9. Add query tests.

## Preferred API

Conceptual:

js
getRecipes({
domain: "food",
filters,
pagination,
});

## Tests

- Cocktail list returns only cocktails.
- Food list returns only food.
- All list returns both.
- Invalid domain input is rejected.
- Pagination is stable within a domain.
- Ingredient relationships remain correct.

## Completion Criteria

- Every recipe-listing query has explicit domain behavior.
- Domain filtering occurs before data reaches the client.
- Existing cocktail routes still display the same catalog.

## Non-Goals

- No visual Kitchen experience yet.
- No food data required beyond optional test fixtures.
- No matcher ranking changes.

---

# 28. Phase 3 — Generalize Matching by Domain

## Objective

Allow one matching engine to evaluate either food or cocktail recipes.

## Required Inspection

Inspect:

- Matcher SQL.
- RPC functions.
- Server services.
- Ranking code.
- Pantry resolution.
- Substitution logic.
- Derivation logic.
- Matching tests.

## Tasks

1. Add domain as an explicit matcher input.
2. Filter candidate recipes by domain.
3. Preserve existing cocktail ranking.
4. Support test food recipes.
5. Distinguish required and optional ingredients.
6. Document pantry-staple behavior.
7. Ensure alias, substitution, and derivation resolution remains shared.
8. Return domain in match-result objects.
9. Add domain-aware matcher indexes if needed.
10. Add regression tests.

## Initial Ranking

Maintain a simple, understandable ranking:

1. Makeable.
2. Missing one.
3. Missing two.
4. Missing more.

Use existing tie-breakers where appropriate.

## Tests

- Food requests never return cocktails.
- Cocktail requests never return food.
- Shared pantry ingredients satisfy either domain.
- Optional ingredients do not increase missing count.
- Aliases work in both domains.
- Substitutions work according to current rules.
- Derivations work according to current rules.
- Cocktail-match snapshots remain stable.

## Completion Criteria

- One matcher supports both domains.
- No second food matcher exists.
- Cocktail matching is unchanged except for explicit domain handling.
- Food fixtures can produce correct results.

## Non-Goals

- No time-aware ranking.
- No equipment-aware matching.
- No quantity-aware pantry depletion.
- No advanced dietary matching.

---

# 29. Phase 4 — Introduce Bar and Kitchen Application Structure

## Objective

Create the top-level product structure without yet building the complete food experience.

## Tasks

1. Define domain route conventions.
2. Add Bar and Kitchen navigation.
3. Add domain-aware layouts or route groups where useful.
4. Create a placeholder Kitchen overview.
5. Preserve existing cocktail URLs through redirects or compatibility routes.
6. Add domain-aware page metadata.
7. Create a domain switcher.
8. Ensure the switcher uses clear navigation semantics.
9. Add mobile navigation behavior.
10. Update global copy that incorrectly describes RecipeAce as cocktails only.

## Route Target

/bar
/bar/matches
/bar/recipes

/kitchen
/kitchen/matches
/kitchen/recipes

Pantry routes may remain shared initially.

## Completion Criteria

- Users can clearly enter Bar or Kitchen.
- Existing cocktail routes still work.
- Domain context is visible.
- Navigation works on desktop and mobile.
- Placeholder Kitchen routes do not pretend unfinished features are complete.

## Non-Goals

- No complete Kitchen catalog.
- No major visual redesign.
- No food pipeline.

---

# 30. Phase 5 — Normalize Shared and Domain-Specific Recipe Metadata

## Objective

Separate generic recipe data from metadata that only applies to food or cocktails.

## Required Inspection

Create a field-by-field table for the current recipes schema.

For every field, identify:

- Shared.
- Cocktail-specific.
- Food-specific.
- Derived.
- Obsolete.

## Tasks

1. Define the minimal shared recipe entity.
2. Define cocktail-specific metadata.
3. Define food-specific metadata.
4. Add detail tables if warranted.
5. Migrate existing cocktail metadata safely.
6. Update recipe reads.
7. Update recipe writes.
8. Update generated types.
9. Add validation.
10. Preserve compatibility during transition.

## Potential Food Metadata

Start with only what the interface needs:

- Prep minutes.
- Cook minutes.
- Total minutes.
- Servings.
- Difficulty.
- Course.
- Cuisine.

Do not add every imaginable recipe field.

## Completion Criteria

- Generic recipe queries are not polluted with unrelated domain assumptions.
- Cocktail metadata still renders.
- Food metadata can be stored and retrieved.
- One recipes table remains authoritative.
- No generic field is duplicated unnecessarily.

## Non-Goals

- No large catalog import.
- No nutrition system.
- No equipment modeling unless immediately necessary.

---

# 31. Phase 6 — Expand the Ingredient Taxonomy

## Objective

Make the shared ingredient catalog capable of representing food ingredients cleanly.

## Required Inspection

Inspect:

- Ingredient category fields.
- Enums.
- UI grouping.
- Ingredient search.
- Normalization.
- Pipeline validation.

## Tasks

1. Identify cocktail-only category limitations.
2. Design a scalable but minimal category model.
3. Migrate existing categories.
4. Add initial food categories.
5. Preserve ingredient IDs and slugs.
6. Update pantry grouping.
7. Update ingredient search.
8. Update ingestion validation.
9. Add category tests.
10. Document taxonomy rules.

## Key Constraint

Do not place recipe domain on ingredients.

An ingredient may appear in both domains.

## Completion Criteria

- Food ingredients can be categorized without hacks.
- Existing cocktail ingredient categories still work.
- No ingredient is duplicated merely because it appears in food.
- Pantry and ingredient search remain usable.

## Non-Goals

- No exhaustive culinary ontology.
- No multiple classification systems unless required.
- No domain-specific ingredient tables.

---

# 32. Phase 7 — Make Recipe Ingredients Food-Ready

## Objective

Support the additional structure food ingredient lines require.

## Tasks

Inspect and, where necessary, support:

- Quantity.
- Unit.
- Preparation note.
- Optional status.
- Display order.
- Recipe section.
- Original display text.
- Normalized canonical ingredient.

Examples:

2 large eggs, separated
1 1/2 cups all-purpose flour
Salt, to taste
2 tablespoons olive oil, divided
Fresh parsley, for serving

## Modeling Principles

Keep separate:

- Ingredient identity.
- Quantity.
- Unit.
- Preparation.
- Optionality.
- Display text.

Do not store:

2 large eggs, separated

as the canonical ingredient name.

## Unit Strategy

Start with a controlled set of common units plus an intentional fallback.

Potential units:

- Teaspoon.
- Tablespoon.
- Cup.
- Ounce.
- Pound.
- Gram.
- Kilogram.
- Milliliter.
- Liter.
- Count.
- Pinch.
- Clove.
- Slice.
- Can.

Do not build a complete international unit-conversion engine in this phase.

## Tests

- Fractional quantities.
- Count ingredients.
- “To taste” ingredients.
- Divided ingredients.
- Optional garnish.
- Section ordering.
- Cocktail ingredient compatibility.

## Completion Criteria

- Food ingredient lines render naturally.
- Canonical matching remains based on ingredient identity.
- Cocktail ingredient rendering is unchanged.
- Optional ingredients are represented explicitly.

---

# 33. Phase 8 — Build the Food Ingestion Adapter

## Objective

Extend the existing pipeline so food recipes can be normalized, validated, reviewed, and inserted safely.

## Tasks

1. Extract shared pipeline lifecycle where necessary.
2. Preserve the cocktail adapter.
3. Add a food input schema.
4. Add a food output schema.
5. Add food-normalization prompts.
6. Add food validators.
7. Add dry-run reporting.
8. Add unresolved-ingredient reporting.
9. Add duplicate detection.
10. Add idempotent persistence.
11. Add domain assignment.
12. Add source and licensing fields.
13. Add failure reporting.
14. Add pipeline tests.

## Required Pipeline Output

Each food recipe should include:

- Generic recipe data.
- Food metadata.
- Ordered instructions.
- Structured ingredient requirements.
- Canonical ingredient mappings.
- Aliases proposed or used.
- Source information.
- Publication state.
- Domain food.

## Completion Criteria

- Food recipes can be processed without touching cocktail prompts.
- Dry runs show all proposed changes.
- Invalid recipes fail before insertion.
- Repeated imports do not duplicate records.
- Cocktail ingestion still works.

## Non-Goals

- No bulk import of hundreds of recipes.
- No automatic publication of unreviewed AI output.
- No universal culinary-substitution generation.

---

# 34. Phase 9 — Seed the First Curated Food Catalog

## Objective

Create a small, representative, reviewed catalog for real application development.

## Initial Target

Start with approximately:

- 10–15 recipes.
- 50–75 canonical ingredients.
- Sufficient overlap between recipes to test pantry matching.

## Recipe Selection Criteria

Choose recipes that:

- Use common ingredients.
- Vary in difficulty.
- Vary in total time.
- Include shared cocktail ingredients.
- Include aliases.
- Include optional ingredients.
- Include different units.
- Include vegetarian options.
- Exercise category filtering.

## Tasks

1. Select approved recipe sources.
2. Record licensing or ownership.
3. Dry-run every recipe.
4. Review canonical ingredient mappings.
5. Review instructions.
6. Resolve duplicate ingredients.
7. Insert recipes as unpublished or staging.
8. Validate matches.
9. Publish only after review.
10. Document known catalog limitations.

## Completion Criteria

- The database contains a coherent initial food dataset.
- Every food recipe has valid domain and metadata.
- No unresolved ingredients remain.
- Matching fixtures reflect real food data.
- Source information is present.

---

# 35. Phase 10 — Build Kitchen Recipe Browsing

## Objective

Build a complete basic food-recipe catalog experience.

## Tasks

1. Build `/kitchen`.
2. Build `/kitchen/recipes`.
3. Add food recipe cards.
4. Add pagination.
5. Add initial food filters.
6. Add loading states.
7. Add empty states.
8. Add error states.
9. Add mobile layouts.
10. Add domain-aware metadata.
11. Ensure server-side data fetching.
12. Add UI tests.

## Initial Filters

Recommended:

- Course.
- Cuisine.
- Total time.
- Difficulty.

Add dietary filters only when metadata is trustworthy.

## Completion Criteria

- Users can browse food recipes.
- No cocktail recipes appear in Kitchen results.
- Pagination and filters work.
- Cards communicate relevant food metadata.
- Pages are usable on mobile and desktop.

---

# 36. Phase 11 — Build Kitchen Matching

## Objective

Expose food pantry matching through the Kitchen interface.

## Tasks

1. Build `/kitchen/matches`.
2. Request food matches from the shared matcher.
3. Display makeable recipes.
4. Display close matches.
5. Display missing required ingredients.
6. Show substitution and derivation satisfaction where useful.
7. Explain staple assumptions.
8. Add sorting and basic filters.
9. Add loading and error states.
10. Add matcher UI tests.

## Completion Criteria

- Kitchen matches use the shared pantry.
- Results contain only food.
- Missing counts are correct.
- Optional ingredients do not block matches.
- Staple behavior is visible and consistent.
- Cocktail matching remains unchanged.

---

# 37. Phase 12 — Integrate Shared Pantry, Favorites, and Shopping List

## Objective

Make shared user systems work naturally across both domains.

## Pantry Tasks

- Confirm one pantry is used everywhere.
- Add Kitchen entry points to pantry management.
- Allow useful category grouping.
- Preserve ingredient ownership.
- Avoid duplicate pantry records.
- Communicate that pantry changes affect both domains.

## Favorites Tasks

- Show all favorites.
- Allow food-only filtering.
- Allow cocktail-only filtering.
- Retain one favorites table.
- Update empty states.

## Shopping List Tasks

- Add missing food ingredients.
- Avoid duplicate ingredient entries.
- Preserve manually added items.
- Show recipe source where available.
- Allow optional grouping by domain or recipe.
- Retain one shopping-list system.

## Completion Criteria

- One pantry powers both domains.
- Users can favorite food and cocktails.
- Users can add missing ingredients from either domain.
- Shared pages can filter by domain.
- No duplicate user systems have been created.

---

# 38. Phase 13 — Unify Recipe Detail Pages

## Objective

Render both food and cocktail recipes through one shared route with domain-specific composition.

## Tasks

1. Use one shared recipe loader.
2. Use one shared recipe-detail route.
3. Render common detail elements.
4. Render cocktail metadata when domain is cocktail.
5. Render food metadata when domain is food.
6. Render ordered instructions.
7. Display pantry availability.
8. Show missing ingredients.
9. Support favorite actions.
10. Support shopping-list actions.
11. Add source attribution.
12. Add SEO metadata.
13. Add structured data where valid.
14. Add not-found and invalid-state handling.

## Completion Criteria

- Food and cocktail recipe details use one route architecture.
- Domain-specific metadata renders correctly.
- Shared actions work for both.
- Invalid combinations fail gracefully.
- Existing cocktail recipe URLs remain valid or redirect safely.

---

# 39. Phase 14 — Expand Search, Filters, and Discovery

## Objective

Make the larger catalog discoverable without creating separate search systems.

## Tasks

1. Add all-domain search.
2. Add domain filtering.
3. Search recipe names and aliases.
4. Search ingredient names and aliases.
5. Add food-specific filters.
6. Preserve cocktail filters.
7. Add shared discovery sections.
8. Handle no-results states.
9. Record useful analytics.
10. Test query performance.

## Potential Discovery Sections

- Makeable now.
- Missing one ingredient.
- Quick food recipes.
- Drinks using ingredients you own.
- Food using ingredients you own.
- Recently added.
- Favorites.
- Shared ingredient spotlights.

## Completion Criteria

- Search can return either or both domains.
- Filters are domain-appropriate.
- Search remains performant.
- Results clearly communicate recipe domain.

---

# 40. Phase 15 — Rebrand and Polish the Unified Product

## Objective

Update product language and visual hierarchy so RecipeAce no longer feels like a cocktail site with food bolted on.

## Tasks

1. Audit all user-facing copy.
2. Update homepage messaging.
3. Update metadata and descriptions.
4. Update empty states.
5. Update onboarding.
6. Update pantry explanations.
7. Update navigation labels.
8. Ensure Bar and Kitchen feel related.
9. Preserve strong existing visual patterns.
10. Avoid unnecessary full redesign.
11. Review icons and imagery.
12. Review domain color usage.
13. Update documentation screenshots if present.

## Messaging Goal

RecipeAce should communicate:

> Add what you have. Discover what you can make.

The wording should comfortably include food and drinks.

## Completion Criteria

- No major page incorrectly describes the product as cocktail-only.
- Bar and Kitchen feel like parts of one product.
- Shared systems are understandable.
- Domain navigation is clear.

---

# 41. Phase 16 — Performance, Security, Accessibility, and Regression Review

## Objective

Review the complete expansion before production rollout.

## Performance Review

- Query counts.
- Database indexes.
- Match latency.
- Route loading.
- Image performance.
- Client bundle size.
- Pagination.
- N+1 behavior.
- Caching.

## Security Review

- RLS.
- Service-role usage.
- Pipeline secrets.
- Write authorization.
- Input validation.
- Unsafe dynamic queries.
- Unpublished recipe access.

## Accessibility Review

- Keyboard navigation.
- Screen readers.
- Focus states.
- Labels.
- Contrast.
- Responsive zoom.
- Reduced motion.
- Semantic structure.

## Regression Review

- Cocktail catalog.
- Cocktail matching.
- Cocktail recipe detail.
- Pantry.
- Favorites.
- Shopping list.
- Authentication.
- Redirects.
- Pipeline.

## Completion Criteria

- No known critical regression remains.
- RLS is verified.
- Core routes meet accessibility expectations.
- Performance is acceptable with realistic catalog size.
- Production migration steps are documented.

---

# 42. Phase 17 — Production Rollout and Cleanup

## Objective

Deploy the expansion safely and remove temporary compatibility code only after stability is confirmed.

## Tasks

1. Back up production data.
2. Review migration order.
3. Run migrations.
4. Regenerate production types if required.
5. Deploy domain-aware backend changes.
6. Deploy domain-aware frontend changes.
7. Seed reviewed food recipes.
8. Perform smoke tests.
9. Monitor logs.
10. Monitor matcher latency.
11. Verify RLS.
12. Verify analytics.
13. Fix production-only issues.
14. Remove temporary compatibility code later.
15. Remove obsolete columns only after confirmed unused.
16. Update this document with final architecture.

## Rollback Planning

Before deployment, document:

- Which migrations are reversible.
- Which data changes are destructive.
- How to disable Kitchen routes.
- How to unpublish food recipes.
- How to restore previous query behavior.
- How to identify failed pipeline inserts.

## Completion Criteria

- Food is live without harming cocktails.
- Monitoring shows no critical errors.
- Production data is valid.
- Temporary flags and compatibility layers are documented.
- Cleanup occurs only after a stability period.

---

# 43. Phase 18 — Post-MVP Enhancements

These should be considered only after the unified food-and-cocktail MVP is stable.

Potential enhancements:

## 43.1 Configurable Pantry Staples

Let users decide which common ingredients RecipeAce should assume they own.

## 43.2 Equipment Profiles

Let users record equipment and filter recipes accordingly.

## 43.3 Quantity-Aware Pantry

Track approximate quantities and warn when a recipe may require more than the user owns.

## 43.4 Serving Scaling

Scale ingredient quantities for different serving counts.

## 43.5 Unit Conversion

Support metric and US customary display preferences.

## 43.6 Meal Planning

Allow recipes to be scheduled across days.

## 43.7 Smarter Shopping Lists

Group ingredients by store section and combine quantities.

## 43.8 Dietary Profiles

Store preferences and exclusions while clearly distinguishing them from medical allergy guarantees.

## 43.9 Improved Substitution Context

Support substitution direction, quality, quantity adjustment, and recipe-specific approval.

## 43.10 Preparation Burden

Rank derivations and recipes based on effort, time, and equipment.

## 43.11 Cross-Domain Recommendations

Examples:

- Cocktails that pair with a meal.
- Food recipes using leftover cocktail ingredients.
- Desserts using spirits in the pantry.
- Meals and drinks sharing citrus or herbs.

## 43.12 Editorial Tools

A dedicated admin or editorial interface may eventually justify a separate deployable application and possibly a monorepo.

Do not adopt that architecture until the need exists.

---

# 44. Prompt-by-Prompt Working Method

The expansion is intended to be completed through multiple prompts.

A productive prompt should identify one phase or tightly scoped subphase.

Examples:

Read docs/expansion-plan.md and complete Phase 0. Inspect the repository and produce the expansion inventory. Do not modify application code yet.

Read docs/expansion-plan.md. Implement only Phase 1: add recipe domain safely. Inspect all recipe creation paths before editing. Run tests and report every changed file.

Read docs/expansion-plan.md and continue Phase 3. Generalize the matcher to accept an explicit domain without changing existing cocktail ranking.

Read docs/expansion-plan.md. Implement the database portion of Phase 5 only. Do not update UI components yet.

Read docs/expansion-plan.md. Complete the food-pipeline dry-run system from Phase 8. Do not insert production recipes.

AI should not interpret “continue” as permission to begin later phases unless the current phase is fully complete.

---

# 45. Required AI Response Format During Implementation

When completing a phase, AI should report:

## Phase

The phase and subphase worked on.

## Repository Findings

Relevant current-state findings discovered before implementation.

## Changes Made

Every meaningful change, grouped by responsibility.

## Files Changed

A complete list of modified, added, or deleted files.

## Database Changes

Migrations, constraints, indexes, policies, functions, or data changes.

## Validation Performed

Commands, tests, type checks, builds, linting, or manual verification.

## Remaining Work

Anything required before the phase is complete.

## Risks or Decisions

Any architectural choice or uncertainty that should be recorded.

AI must not claim a phase is complete when:

- Tests fail.
- Build fails.
- Required files were not inspected.
- Migration behavior is unverified.
- Cocktail regression behavior is unknown.
- Significant TODOs remain.

---

# 46. Decision Log

The following decisions are currently authoritative.

## Decision 1 — One Application

RecipeAce will remain one Next.js application.

## Decision 2 — No Monorepo Yet

The project will not become a monorepo solely to add food.

## Decision 3 — No Separate Engine Package Yet

The matching engine will be modularized internally but will not initially become a standalone package.

## Decision 4 — One Supabase Project

Food and cocktail data will use one Supabase project.

## Decision 5 — One Primary Application Schema

Food will not live in a separate Postgres schema.

Schemas may later be used for operational separation such as internal pipeline or analytics concerns, but not to split food and cocktails into separate data silos.

## Decision 6 — Domain on Recipes Only

Recipe domain is persistently classified on the recipes table only.

Related data inherits domain through the recipe relationship.

## Decision 7 — One Ingredient Catalog

Food and cocktails share canonical ingredients, aliases, substitutions, and derivations.

## Decision 8 — One Pantry

Users maintain one pantry.

## Decision 9 — One Matcher

Food and cocktails use one generalized matching engine with an explicit domain input.

## Decision 10 — Separate Experiences, Shared Core

Bar and Kitchen receive different routes and presentation while sharing core systems.

## Decision 11 — Separate Domain Pipeline Adapters

Food and cocktail ingestion use separate prompts, validation, and transformations within one shared pipeline lifecycle.

## Decision 12 — Curated Food First

The initial food catalog will prioritize reviewed, owned, licensed, or otherwise approved recipe content over bulk unreviewed AI generation.

## Decision 13 — Incremental Migration

Database and application changes will be additive before obsolete structures are removed.

## Decision 14 — Preserve Cocktail Behavior

No food-expansion phase is complete if existing cocktail functionality is materially broken.

---

# 47. Architectural Invariants

These rules must remain true throughout implementation.

1. Every recipe has exactly one valid domain.
2. Domain classification is stored on recipes.
3. Ingredients are not domain-owned.
4. Users have one pantry.
5. Recipe matching uses one core engine.
6. Food and cocktail recipes use one recipe-identity model.
7. Favorites reference shared recipes.
8. Shopping lists reference shared ingredients.
9. Domain filtering happens on the server or database.
10. Food ingestion explicitly assigns the food domain.
11. Cocktail ingestion explicitly assigns the cocktail domain.
12. Existing cocktail recipes remain accessible.
13. User-owned data remains protected by RLS.
14. New food metadata does not force irrelevant null-heavy fields into every shared query.
15. AI-generated content is validated before insertion.
16. Unreviewed food recipes are not automatically published.
17. Shared components do not become unmaintainable collections of boolean flags.
18. Destructive migrations do not occur before dependent code is removed.
19. Generated database types remain synchronized with the schema.
20. Every phase includes regression validation.

---

# 48. Definition of MVP Completion

The food-expansion MVP is complete when:

- RecipeAce has visible Bar and Kitchen experiences.
- Existing cocktail functionality still works.
- Recipes have a valid domain.
- Domain exists only on recipes as content classification.
- Food and cocktails use one Supabase project.
- Food and cocktails use one ingredient catalog.
- Food and cocktails use one pantry.
- Food and cocktails use one matcher.
- Users can browse food recipes.
- Users can view food recipe details.
- Users can see food recipes they can make.
- Users can see missing food ingredients.
- Users can favorite food recipes.
- Users can add missing food ingredients to the shared shopping list.
- Food recipes contain reviewed ingredients and instructions.
- The food-ingestion path is validated and idempotent.
- Kitchen routes are responsive and accessible.
- Bar routes remain stable.
- Database security has been reviewed.
- Production rollout and rollback procedures are documented.

The MVP does not require advanced meal planning, nutrition, equipment, exact quantity tracking, or a large recipe catalog.

---

# 49. Final Product Vision

RecipeAce should evolve from a cocktail recipe matcher into a unified “what can I make?” platform.

The product should not feel like two disconnected websites sharing a login.

It should feel like one intelligent pantry system with two natural modes:

Bar
Kitchen

The shared ingredient graph is the foundation.

The pantry is the user’s source of truth.

Recipes are domain-aware.

The matching engine is universal.

The interface changes according to context.

The architecture remains simple enough to build incrementally, test reliably, and maintain as the catalog grows.

---

# 50. As-Built Architecture

> Added on completion of phases 1–17, per §42 task 16 ("update this document
> with final architecture"). Where the built system differs from what earlier
> sections proposed, the difference and its reason are recorded here. Phase by
> phase detail lives in `docs/expansion-inventory.md`; the rollout procedure
> lives in `docs/expansion-rollout.md`.

## 50.1 What was built

One Next.js application, one Supabase project, one `public` schema.

Domain is persisted in exactly one place — `recipes.domain`, a `recipe_domain`
enum, NOT NULL with **no default** — and every other table derives it by
joining. The detail tables carry no domain column, as §3 requires.

```
recipes                      shared fields + domain + difficulty
  ├─ cocktail_recipe_details method, glass, garnish, strength, base_spirit, flavor_tags
  ├─ food_recipe_details     prep/cook/total minutes, servings, course, cuisine
  ├─ recipe_ingredients      quantity, unit, preparation, optional, section, order
  └─ favorite_recipes        user_id → recipe_id

cocktail_recipes / food_recipes   security_invoker views: each domain's
                                  details flattened onto the shared fields
```

Routes: `/bar`, `/bar/recipes`, `/bar/matches`; `/kitchen`,
`/kitchen/recipes`, `/kitchen/matches`; and outside both, the shared surfaces —
`/` (pantry), `/recipes/[slug]`, `/ingredients/[slug]`, `/favorites`,
`/shopping`, `/search`. `/recipes` and `/matches` are 307 redirects.

One matcher: `match_recipes(pantry, max_missing, p_domain)` and its
`_detail` companion. The domain argument filters candidates and changes
nothing else — proven by running five representative pantries against the
schema with and without the change and diffing the results.

## 50.2 Decisions taken during implementation

1. **The ingredient taxonomy stayed an enum** (§8.6 offered a lookup table).
   Fifteen food values were added. The taxonomy is a fixed product vocabulary,
   not user data, and nothing needs per-category metadata yet. Revisit when a
   category must carry data of its own — a shopping-list aisle, an icon, a
   translated label.
2. **Catalog views**, which §8 did not anticipate. A catalog page filters,
   sorts and paginates across shared _and_ domain fields in one query, and
   PostgREST cannot order parent rows by an embedded column. The views keep
   storage normalised and the query layer single.
3. **The food adapter emits SQL** rather than writing through the admin client
   (§16 assumed database writes). Curated content is reference data, and this
   repository already compiles reference data from a typed source to an
   idempotent SQL file. It also makes the whole path testable with no Supabase
   project — the tests apply the generated file and re-apply it.
4. **"To taste" seasoning is optional.** §11.3 requires optional ingredients
   not to make a recipe look unavailable; an unowned pinch of pepper hiding a
   dinner is exactly that failure.
5. **The staple policy is the pre-existing five** — water, ice, crushed ice,
   sugar, salt — unchanged, cross-domain, and now stated in the interface
   under both matches pages. No food staples were added, because `is_staple`
   has no domain and adding one would silently change cocktail results.
6. **No food substitutions or derivations shipped.** This matcher treats
   substitutions as universal and bidirectional and derivations as free; both
   assumptions are wrong for food (§8.8, §8.9). Post-MVP.
7. **The product name stayed "In House Mixers" and §10's first open question
   is still open.** This document's own naming — its title, §49, and the
   repository name — was read as a decision during implementation and the
   product was briefly renamed; the owner corrected it. The name is expected
   to change again, so it now lives in exactly one place, `SITE_NAME` in
   `src/lib/site.ts`, and changing it is one line. **Note for future
   sessions: this plan calls the product "RecipeAce" throughout, and that is
   not the site's name.** The mark, separately, is now a fork and a glass
   rather than a martini glass.
8. **Deprecated columns were kept.** `recipes.method`, `glass`, `garnish`,
   `strength`, `base_spirit` and `flavor_tags` are unread, unwritten, and
   commented as deprecated. Dropping them is scheduled after a stability
   period (rollout §8), per §23.

## 50.3 What is deferred

Everything in §43, plus: shopping-list account sync, equipment, quantity-aware
matching, dietary filters (no trustworthy metadata exists yet, and §11.8
forbids guessing), and the performance work in rollout §7 — each with a stated
trigger rather than a date.
