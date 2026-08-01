/**
 * The curated food catalog — the Kitchen's reference data (expansion phase 9).
 *
 * Structure mirrors src/data/cocktail-seed.ts: a typed source of truth that
 * compiles to idempotent SQL. Here the compiler is the food ingestion adapter:
 *
 *     npm run pipeline:food -- --dry-run    validate and report
 *     npm run pipeline:food                 write supabase/seed_food.sql
 *
 * CONTENT AND LICENCE. Every recipe here is original: written for this app,
 * describing ordinary technique in its own words. Nothing is transcribed from
 * a cookbook or a website, which is what §15 requires — ingredient lists carry
 * little protection but headnotes and instruction wording do. `source` and
 * `license` are both "original", and the pipeline refuses to ingest a recipe
 * that states neither.
 *
 * PUBLICATION. `publish: true` means "reviewed and ready". These thirteen were
 * reviewed as they were written; anything added later should land without the
 * flag and be published in a separate, deliberate change (§34).
 *
 * COVERAGE. The catalog is shaped to exercise the system rather than to be
 * large (§34): shared cocktail ingredients (lemon juice, lime juice, fresh
 * mint, fresh basil, milk, eggs, sugar, salt), repeated lines ("divided"),
 * sections, optional lines, every unit family, a spread of times and
 * difficulties, and at least one recipe using each food category the taxonomy
 * gained in phase 6.
 *
 * NOT INCLUDED, deliberately: substitutions and derivations. Food
 * substitutions are context-sensitive (§8.8) and the matcher treats them as
 * universal, so the MVP ships none rather than ship wrong ones; food
 * derivations are mostly effortful transformations the matcher would wrongly
 * treat as free (§8.9). Both are post-MVP work.
 */

import type { FoodCatalog } from "../../scripts/pipeline/domains/food/source.ts";

export const foodCatalog: FoodCatalog = {
  ingredients: [
    // ── Produce ────────────────────────────────────────────────────────────
    { name: "onion", category: "produce" },
    { name: "red onion", category: "produce", parent: "onion" },
    { name: "green onion", category: "produce" },
    { name: "garlic", category: "produce" },
    { name: "tomato", category: "produce" },
    { name: "carrot", category: "produce" },
    { name: "celery", category: "produce" },
    { name: "potato", category: "produce" },
    { name: "banana", category: "produce" },
    { name: "frozen peas", category: "produce" },

    // ── Herbs and spices ───────────────────────────────────────────────────
    { name: "flat-leaf parsley", category: "herb" },
    { name: "cilantro", category: "herb" },
    { name: "black pepper", category: "spice" },
    { name: "ground cumin", category: "spice" },
    { name: "red pepper flakes", category: "spice" },
    { name: "ground cinnamon", category: "spice" },
    { name: "dried oregano", category: "spice" },

    // ── Dairy ──────────────────────────────────────────────────────────────
    { name: "butter", category: "dairy" },
    { name: "cheddar cheese", category: "dairy" },
    { name: "parmesan cheese", category: "dairy" },
    { name: "feta cheese", category: "dairy" },

    // ── Cupboard. None of these is a staple: the phase 3 policy keeps that
    //    set to five, because is_staple has no domain (see §11.4).
    { name: "olive oil", category: "oil_and_fat" },
    { name: "vegetable oil", category: "oil_and_fat" },
    { name: "sesame oil", category: "oil_and_fat" },
    { name: "all-purpose flour", category: "baking" },
    { name: "baking soda", category: "baking" },
    { name: "baking powder", category: "baking" },
    { name: "vanilla extract", category: "baking" },
    { name: "chocolate chips", category: "baking" },
    { name: "brown sugar", category: "baking" },
    { name: "honey", category: "sweetener" },

    // ── Grains, pasta, bread ───────────────────────────────────────────────
    { name: "rolled oats", category: "grain" },
    { name: "white rice", category: "grain" },
    { name: "spaghetti", category: "pasta" },
    { name: "sliced bread", category: "bread" },
    { name: "corn tortilla", category: "bread" },

    // ── Legumes, tins, condiments, meat ────────────────────────────────────
    { name: "brown lentils", category: "legume" },
    { name: "black beans", category: "legume" },
    { name: "canned crushed tomatoes", category: "canned_good" },
    { name: "vegetable stock", category: "canned_good" },
    { name: "dijon mustard", category: "condiment" },
    { name: "soy sauce", category: "condiment" },
    { name: "chicken breast", category: "meat" },
    { name: "chicken thigh", category: "meat" },
  ],

  // Regional and shopping-list spellings, mapped onto one canonical row so the
  // catalog never grows a second record for the same thing (§8.7).
  aliases: [
    { alias: "scallions", ingredient: "green onion" },
    { alias: "spring onion", ingredient: "green onion" },
    { alias: "coriander leaves", ingredient: "cilantro" },
    { alias: "fresh coriander", ingredient: "cilantro" },
    { alias: "italian parsley", ingredient: "flat-leaf parsley" },
    { alias: "yellow onion", ingredient: "onion" },
    { alias: "brown onion", ingredient: "onion" },
    { alias: "plain flour", ingredient: "all-purpose flour" },
    { alias: "bicarbonate of soda", ingredient: "baking soda" },
    { alias: "chilli flakes", ingredient: "red pepper flakes" },
    { alias: "crushed red pepper", ingredient: "red pepper flakes" },
    { alias: "porridge oats", ingredient: "rolled oats" },
    { alias: "old-fashioned oats", ingredient: "rolled oats" },
    { alias: "extra virgin olive oil", ingredient: "olive oil" },
    { alias: "unsalted butter", ingredient: "butter" },
    { alias: "salted butter", ingredient: "butter" },
    { alias: "parmigiano reggiano", ingredient: "parmesan cheese" },
    { alias: "freshly ground black pepper", ingredient: "black pepper" },
    { alias: "tinned tomatoes", ingredient: "canned crushed tomatoes" },
    { alias: "veg stock", ingredient: "vegetable stock" },
  ],

  recipes: [
    {
      name: "Soft Scrambled Eggs on Toast",
      description:
        "Eggs cooked low and slow until they set into soft curds, on buttered toast.",
      course: "breakfast",
      cuisine: "american",
      difficulty: "easy",
      prepMinutes: 3,
      cookMinutes: 7,
      servings: 2,
      instructions: [
        "Beat the egg with the milk and a pinch of salt until no streaks of white remain.",
        "Melt half the butter in a non-stick pan over low heat.",
        "Add the egg and stir slowly and constantly, scraping the base of the pan.",
        "Take the pan off the heat while the curds still look slightly underdone — they carry on setting.",
        "Toast the bread, spread it with the remaining butter, and pile the egg on top.",
        "Finish with black pepper.",
      ],
      ingredients: [
        { name: "whole egg", amount: 4, unit: "each" },
        { name: "milk", amount: 2, unit: "tbsp" },
        { name: "butter", amount: 1, unit: "tbsp", preparation: "divided" },
        { name: "sliced bread", amount: 2, unit: "slice" },
        {
          name: "butter",
          amount: 1,
          unit: "tbsp",
          preparation: "divided, for the toast",
        },
        { name: "salt", preparation: "to taste", optional: true },
        { name: "black pepper", preparation: "to taste", optional: true },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Overnight Oats",
      description:
        "Oats soaked in milk overnight, sweetened with honey and finished with berries.",
      course: "breakfast",
      cuisine: "american",
      difficulty: "easy",
      prepMinutes: 5,
      cookMinutes: 0,
      servings: 2,
      instructions: [
        "Stir the rolled oats, milk, honey and cinnamon together in a jar or bowl.",
        "Cover and refrigerate for at least six hours, or overnight.",
        "Stir once before serving; loosen with a splash more milk if it has set firm.",
        "Top with the strawberry.",
      ],
      ingredients: [
        { name: "rolled oats", amount: 1, unit: "cup" },
        { name: "milk", amount: 1, unit: "cup" },
        { name: "honey", amount: 2, unit: "tbsp" },
        {
          name: "ground cinnamon",
          amount: 0.5,
          unit: "tsp",
          optional: true,
        },
        {
          name: "strawberry",
          amount: 1,
          unit: "cup",
          preparation: "hulled and halved",
          optional: true,
        },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Banana Pancakes",
      description:
        "A thick batter with mashed banana stirred through, cooked in butter.",
      course: "breakfast",
      cuisine: "american",
      difficulty: "easy",
      prepMinutes: 10,
      cookMinutes: 10,
      servings: 4,
      instructions: [
        "Mash the banana in a large bowl until nearly smooth.",
        "Whisk in the milk, egg and melted butter.",
        "Add the flour, sugar, baking powder and salt, and stir just until combined — a few lumps are fine.",
        "Cook ladles of batter in a buttered pan over medium heat until bubbles form and the edges set, about two minutes.",
        "Flip and cook for another minute, until golden.",
      ],
      ingredients: [
        { name: "banana", amount: 2, unit: "each", preparation: "very ripe" },
        { name: "milk", amount: 1, unit: "cup" },
        { name: "whole egg", amount: 1, unit: "each" },
        {
          name: "butter",
          amount: 2,
          unit: "tbsp",
          preparation: "melted, divided",
        },
        { name: "all-purpose flour", amount: 1.5, unit: "cup" },
        { name: "sugar", amount: 2, unit: "tbsp" },
        { name: "baking powder", amount: 2, unit: "tsp" },
        { name: "salt", amount: 0.5, unit: "tsp" },
        {
          name: "butter",
          amount: 1,
          unit: "tbsp",
          preparation: "divided, for the pan",
        },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Grilled Cheese Sandwich",
      description:
        "Cheddar between buttered bread, pressed in a pan until molten.",
      course: "sandwich",
      cuisine: "american",
      difficulty: "easy",
      prepMinutes: 3,
      cookMinutes: 7,
      servings: 1,
      instructions: [
        "Butter one side of each slice of bread.",
        "Lay one slice butter-side down in a cold pan, cover with the cheddar cheese, and top with the second slice, butter-side up.",
        "Cook over medium-low heat until the underside is deep gold, about four minutes.",
        "Flip and cook until the second side matches and the cheese has melted through.",
      ],
      ingredients: [
        { name: "sliced bread", amount: 2, unit: "slice" },
        {
          name: "cheddar cheese",
          amount: 2,
          unit: "oz",
          preparation: "sliced or grated",
        },
        { name: "butter", amount: 1, unit: "tbsp", preparation: "softened" },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Cucumber Tomato Salad",
      description:
        "Cucumber, tomato and red onion dressed with lemon and olive oil.",
      course: "salad",
      cuisine: "mediterranean",
      difficulty: "easy",
      prepMinutes: 10,
      cookMinutes: 0,
      servings: 4,
      instructions: [
        "Cut the cucumber and tomato into rough chunks and slice the red onion thin.",
        "Salt the vegetables lightly and leave them for five minutes.",
        "Whisk the olive oil and lemon juice together with a grind of black pepper, and pour it over.",
        "Toss, then scatter the feta cheese and mint on top.",
      ],
      ingredients: [
        { name: "cucumber", amount: 1, unit: "each" },
        { name: "tomato", amount: 3, unit: "each" },
        { name: "red onion", amount: 0.5, unit: "each" },
        { name: "olive oil", amount: 3, unit: "tbsp" },
        { name: "lemon juice", amount: 2, unit: "tbsp" },
        { name: "salt", preparation: "to taste", optional: true },
        { name: "black pepper", preparation: "to taste", optional: true },
        {
          name: "feta cheese",
          amount: 3,
          unit: "oz",
          preparation: "crumbled",
          optional: true,
        },
        {
          name: "fresh mint",
          amount: 8,
          unit: "leaves",
          preparation: "torn",
          optional: true,
        },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Lemon Vinaigrette",
      description:
        "A sharp everyday dressing that keeps for a week in the fridge.",
      course: "sauce",
      cuisine: "french",
      difficulty: "easy",
      prepMinutes: 5,
      cookMinutes: 0,
      servings: 6,
      instructions: [
        "Whisk the lemon juice, dijon mustard, honey, salt and pepper together in a bowl.",
        "Pour the olive oil in slowly, whisking, until the dressing thickens and stops separating.",
        "Taste and adjust with more lemon juice or salt.",
      ],
      ingredients: [
        { name: "lemon juice", amount: 3, unit: "tbsp" },
        { name: "dijon mustard", amount: 1, unit: "tsp" },
        { name: "honey", amount: 1, unit: "tsp" },
        { name: "olive oil", amount: 0.5, unit: "cup" },
        { name: "salt", preparation: "to taste", optional: true },
        { name: "black pepper", preparation: "to taste", optional: true },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Garlic Butter Spaghetti",
      description:
        "Spaghetti tossed with garlic softened in butter and olive oil, finished with parmesan.",
      course: "main",
      cuisine: "italian",
      difficulty: "easy",
      prepMinutes: 5,
      cookMinutes: 15,
      servings: 2,
      instructions: [
        "Boil the spaghetti in well-salted water until just tender, then reserve a cup of the cooking water and drain.",
        "While it cooks, warm the olive oil and butter in a wide pan over low heat.",
        "Add the sliced garlic and the red pepper flakes and cook gently until the garlic is pale gold — do not let it brown.",
        "Add the drained spaghetti to the pan with a splash of the cooking water and toss hard until the sauce clings.",
        "Take it off the heat, stir through the parmesan cheese and parsley, and season with salt.",
      ],
      ingredients: [
        { name: "spaghetti", amount: 200, unit: "g" },
        { name: "olive oil", amount: 3, unit: "tbsp" },
        { name: "butter", amount: 2, unit: "tbsp" },
        {
          name: "garlic",
          amount: 4,
          unit: "clove",
          preparation: "thinly sliced",
        },
        {
          name: "red pepper flakes",
          amount: 0.5,
          unit: "tsp",
          optional: true,
        },
        {
          name: "parmesan cheese",
          amount: 1,
          unit: "oz",
          preparation: "finely grated",
        },
        {
          name: "flat-leaf parsley",
          amount: 2,
          unit: "tbsp",
          preparation: "chopped",
          optional: true,
        },
        { name: "salt", preparation: "to taste", optional: true },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Spaghetti with Tomato Sauce",
      description:
        "A slow-simmered tinned tomato sauce, seasoned with basil and a pinch of sugar.",
      course: "main",
      cuisine: "italian",
      difficulty: "medium",
      prepMinutes: 10,
      cookMinutes: 35,
      servings: 4,
      instructions: [
        "Warm half the olive oil in a saucepan and cook the onion gently until soft and translucent, about eight minutes.",
        "Add the garlic and cook for another minute.",
        "Tip in the canned crushed tomatoes, add the sugar and a good pinch of salt, and simmer uncovered for twenty-five minutes, stirring now and then.",
        "Boil the spaghetti in well-salted water until just tender, and drain.",
        "Stir the remaining olive oil and the torn basil into the sauce, then toss it with the pasta.",
        "Serve with parmesan cheese.",
      ],
      ingredients: [
        {
          name: "olive oil",
          amount: 3,
          unit: "tbsp",
          preparation: "divided",
          section: "For the sauce",
        },
        {
          name: "onion",
          amount: 1,
          unit: "each",
          preparation: "finely chopped",
          section: "For the sauce",
        },
        {
          name: "garlic",
          amount: 3,
          unit: "clove",
          preparation: "chopped",
          section: "For the sauce",
        },
        {
          name: "canned crushed tomatoes",
          amount: 800,
          unit: "g",
          section: "For the sauce",
        },
        { name: "sugar", amount: 1, unit: "tsp", section: "For the sauce" },
        {
          name: "fresh basil",
          amount: 10,
          unit: "leaves",
          preparation: "torn",
          section: "For the sauce",
        },
        {
          name: "salt",
          preparation: "to taste",
          optional: true,
          section: "For the sauce",
        },
        { name: "spaghetti", amount: 400, unit: "g", section: "To serve" },
        {
          name: "parmesan cheese",
          amount: 2,
          unit: "oz",
          preparation: "grated",
          optional: true,
          section: "To serve",
        },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Chicken Fried Rice",
      description:
        "Cold rice fried hard with chicken, egg and peas, seasoned with soy and sesame.",
      course: "main",
      cuisine: "chinese",
      difficulty: "medium",
      prepMinutes: 15,
      cookMinutes: 15,
      servings: 4,
      instructions: [
        "Cook the white rice ahead and chill it — day-old rice fries far better than fresh.",
        "Heat half the vegetable oil in a wok or large pan until it shimmers, and cook the diced chicken breast until browned and cooked through. Set it aside.",
        "Add the remaining oil, then the garlic and the white parts of the green onion, and stir for thirty seconds.",
        "Push everything to one side, pour in the beaten egg, and scramble it quickly.",
        "Add the rice and the frozen peas and fry hard, breaking up any clumps, until the grains separate and start to catch.",
        "Return the chicken, add the soy sauce and sesame oil, and toss to coat.",
        "Finish with the green tops of the onion.",
      ],
      ingredients: [
        {
          name: "white rice",
          amount: 3,
          unit: "cup",
          preparation: "cooked and chilled",
        },
        {
          name: "chicken breast",
          amount: 1,
          unit: "lb",
          preparation: "diced",
        },
        {
          name: "vegetable oil",
          amount: 2,
          unit: "tbsp",
          preparation: "divided",
        },
        { name: "garlic", amount: 2, unit: "clove", preparation: "chopped" },
        {
          name: "green onion",
          amount: 4,
          unit: "each",
          preparation: "sliced, white and green parts kept apart",
        },
        { name: "whole egg", amount: 2, unit: "each", preparation: "beaten" },
        { name: "frozen peas", amount: 1, unit: "cup" },
        { name: "soy sauce", amount: 3, unit: "tbsp" },
        { name: "sesame oil", amount: 1, unit: "tsp" },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Lentil Soup",
      description:
        "Brown lentils simmered with a soffritto of onion, carrot and celery.",
      course: "soup",
      cuisine: "mediterranean",
      difficulty: "easy",
      prepMinutes: 15,
      cookMinutes: 40,
      servings: 4,
      instructions: [
        "Warm the olive oil in a heavy pot and cook the onion, carrot and celery over medium-low heat until soft, about ten minutes.",
        "Add the garlic and ground cumin and cook for a minute, until fragrant.",
        "Stir in the brown lentils, canned crushed tomatoes and vegetable stock.",
        "Bring to a boil, then reduce to a simmer and cook until the lentils are tender, thirty to forty minutes.",
        "Season with salt and black pepper, and finish with the lemon juice — it lifts the whole pot.",
      ],
      ingredients: [
        { name: "olive oil", amount: 2, unit: "tbsp" },
        { name: "onion", amount: 1, unit: "each", preparation: "chopped" },
        { name: "carrot", amount: 2, unit: "each", preparation: "chopped" },
        { name: "celery", amount: 2, unit: "each", preparation: "chopped" },
        { name: "garlic", amount: 3, unit: "clove", preparation: "chopped" },
        { name: "ground cumin", amount: 1, unit: "tsp" },
        {
          name: "brown lentils",
          amount: 1.5,
          unit: "cup",
          preparation: "rinsed",
        },
        { name: "canned crushed tomatoes", amount: 400, unit: "g" },
        { name: "vegetable stock", amount: 6, unit: "cup" },
        { name: "lemon juice", amount: 2, unit: "tbsp" },
        { name: "salt", preparation: "to taste", optional: true },
        { name: "black pepper", preparation: "to taste", optional: true },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Sheet-Pan Chicken and Potatoes",
      description:
        "Chicken thighs and potatoes roasted together until the skin crisps and the potatoes take on the fat.",
      course: "main",
      cuisine: "mediterranean",
      difficulty: "easy",
      prepMinutes: 15,
      cookMinutes: 45,
      servings: 4,
      instructions: [
        "Heat the oven to 425°F (220°C).",
        "Toss the potato and carrot with half the olive oil, the dried oregano, salt and black pepper, and spread them on a sheet pan.",
        "Rub the chicken thigh pieces with the remaining oil and the garlic, season them well, and set them on top, skin side up.",
        "Roast for forty to forty-five minutes, until the chicken is cooked through and the potatoes are browned at the edges.",
        "Squeeze the lemon over everything before serving.",
      ],
      ingredients: [
        {
          name: "chicken thigh",
          amount: 8,
          unit: "each",
          preparation: "bone-in, skin-on",
        },
        {
          name: "potato",
          amount: 1.5,
          unit: "lb",
          preparation: "cut into chunks",
        },
        {
          name: "carrot",
          amount: 3,
          unit: "each",
          preparation: "cut into batons",
        },
        {
          name: "olive oil",
          amount: 4,
          unit: "tbsp",
          preparation: "divided",
        },
        { name: "garlic", amount: 4, unit: "clove", preparation: "crushed" },
        { name: "dried oregano", amount: 2, unit: "tsp" },
        { name: "lemon", amount: 1, unit: "each", preparation: "halved" },
        { name: "salt", preparation: "to taste", optional: true },
        { name: "black pepper", preparation: "to taste", optional: true },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Black Bean Tacos",
      description:
        "Cumin-spiced black beans in warm tortillas, with red onion and lime.",
      course: "main",
      cuisine: "mexican",
      difficulty: "easy",
      prepMinutes: 10,
      cookMinutes: 10,
      servings: 4,
      instructions: [
        "Warm the olive oil in a pan and cook the red onion until it softens.",
        "Add the ground cumin and cook for thirty seconds, then tip in the black beans with a splash of water.",
        "Mash about half the beans against the side of the pan and simmer until thick.",
        "Season with salt and half the lime juice.",
        "Warm the corn tortilla in a dry pan until pliable and blistered in spots.",
        "Fill them with the beans, then finish with cilantro, cheddar cheese, hot sauce and the remaining lime juice.",
      ],
      ingredients: [
        { name: "olive oil", amount: 1, unit: "tbsp", section: "For the beans" },
        {
          name: "red onion",
          amount: 0.5,
          unit: "each",
          preparation: "finely chopped",
          section: "For the beans",
        },
        {
          name: "ground cumin",
          amount: 1,
          unit: "tsp",
          section: "For the beans",
        },
        {
          name: "black beans",
          amount: 800,
          unit: "g",
          preparation: "drained and rinsed",
          section: "For the beans",
        },
        {
          name: "lime juice",
          amount: 2,
          unit: "tbsp",
          preparation: "divided",
          section: "For the beans",
        },
        {
          name: "salt",
          preparation: "to taste",
          optional: true,
          section: "For the beans",
        },
        {
          name: "corn tortilla",
          amount: 8,
          unit: "each",
          section: "To serve",
        },
        {
          name: "cilantro",
          amount: 3,
          unit: "tbsp",
          preparation: "chopped",
          optional: true,
          section: "To serve",
        },
        {
          name: "cheddar cheese",
          amount: 2,
          unit: "oz",
          preparation: "grated",
          optional: true,
          section: "To serve",
        },
        {
          name: "hot sauce",
          preparation: "to taste",
          optional: true,
          section: "To serve",
        },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },

    {
      name: "Chocolate Chip Cookies",
      description:
        "Chewy in the middle, crisp at the edge, from a creamed butter-and-sugar dough.",
      course: "dessert",
      cuisine: "american",
      difficulty: "medium",
      prepMinutes: 20,
      cookMinutes: 12,
      servings: 24,
      instructions: [
        "Heat the oven to 350°F (175°C) and line two baking sheets.",
        "Beat the softened butter with the brown sugar and sugar until pale and fluffy, about three minutes.",
        "Beat in the egg and vanilla extract.",
        "Stir the flour, baking soda and salt together, then fold them in until no dry flour remains.",
        "Fold through the chocolate chips.",
        "Drop rounded tablespoons onto the sheets, leaving room to spread.",
        "Bake for ten to twelve minutes, until the edges are set and the centres still look soft. They firm up as they cool.",
      ],
      ingredients: [
        { name: "butter", amount: 8, unit: "oz", preparation: "softened" },
        {
          name: "brown sugar",
          amount: 1,
          unit: "cup",
          preparation: "packed",
        },
        { name: "sugar", amount: 0.5, unit: "cup" },
        { name: "whole egg", amount: 1, unit: "each" },
        { name: "vanilla extract", amount: 2, unit: "tsp" },
        { name: "all-purpose flour", amount: 2.25, unit: "cup" },
        { name: "baking soda", amount: 1, unit: "tsp" },
        { name: "salt", amount: 0.5, unit: "tsp" },
        { name: "chocolate chips", amount: 2, unit: "cup" },
      ],
      source: { name: "original", license: "original" },
      publish: true,
    },
  ],
};
