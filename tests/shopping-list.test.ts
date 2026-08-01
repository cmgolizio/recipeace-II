// The shared shopping list (expansion phase 12). One list for both domains,
// with each item remembering the recipe that sent you shopping — including
// across the upgrade from the pre-expansion names-only format.

import { afterEach, beforeEach, expect, test, vi } from "vitest";

/** A localStorage stand-in; the store only ever uses these four methods. */
function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    get size() {
      return data.size;
    },
    raw: data,
  };
}

type Store = typeof import("../src/lib/shopping/store");

/**
 * The store keeps module-level state and reads localStorage on first
 * subscribe, so each test gets a fresh module against a fresh storage.
 */
async function loadStore(seed?: Record<string, string>): Promise<{
  store: Store;
  storage: ReturnType<typeof fakeStorage>;
}> {
  const storage = fakeStorage(seed);
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.resetModules();
  const store = (await import("../src/lib/shopping/store")) as Store;
  return { store, storage };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("an item added from a recipe remembers where it came from", async () => {
  const { store, storage } = await loadStore();
  store.addToShopping("garlic", {
    slug: "garlic-butter-spaghetti",
    name: "Garlic Butter Spaghetti",
    domain: "food",
  });
  store.addToShopping("gin");

  const saved: unknown = JSON.parse(
    storage.getItem("recipeace.shopping.v2") ?? "[]",
  );
  expect(saved).toEqual([
    {
      name: "garlic",
      from: {
        slug: "garlic-butter-spaghetti",
        name: "Garlic Butter Spaghetti",
        domain: "food",
      },
    },
    { name: "gin" },
  ]);
});

test("one list serves both domains", async () => {
  const { store } = await loadStore();
  store.addToShopping("garlic", {
    slug: "lentil-soup",
    name: "Lentil Soup",
    domain: "food",
  });
  store.addToShopping("campari", {
    slug: "negroni",
    name: "Negroni",
    domain: "cocktail",
  });

  const domains = store
    .shoppingItems()
    .map((item) => item.from?.domain)
    .filter(Boolean);
  expect(domains).toEqual(["food", "cocktail"]);
});

test("an ingredient already on the list is not duplicated", async () => {
  const { store } = await loadStore();
  store.addToShopping("olive oil", {
    slug: "lentil-soup",
    name: "Lentil Soup",
    domain: "food",
  });
  store.addToShopping("olive oil", {
    slug: "black-bean-tacos",
    name: "Black Bean Tacos",
    domain: "food",
  });

  const items = store.shoppingItems();
  expect(items).toHaveLength(1);
  // The first recipe that sent you shopping is the one worth remembering.
  expect(items[0].from?.slug).toBe("lentil-soup");
});

test("a pre-expansion list is carried over, not lost", async () => {
  const { store, storage } = await loadStore({
    "recipeace.shopping.v1": JSON.stringify(["gin", "sweet vermouth"]),
  });
  expect(store.shoppingItems()).toEqual([
    { name: "gin" },
    { name: "sweet vermouth" },
  ]);
  // Migrated once, and the old key is not left behind.
  expect(storage.getItem("recipeace.shopping.v1")).toBeNull();
  expect(storage.getItem("recipeace.shopping.v2")).not.toBeNull();
});

test("removing and clearing leave nothing behind", async () => {
  const { store, storage } = await loadStore();
  store.addToShopping("garlic");
  store.addToShopping("onion");
  store.removeFromShopping("garlic");
  expect(store.shoppingItems().map((i) => i.name)).toEqual(["onion"]);

  store.clearShopping();
  expect(store.shoppingItems()).toEqual([]);
  expect(storage.getItem("recipeace.shopping.v2")).toBeNull();
});

test("malformed storage is ignored rather than thrown", async () => {
  const { store } = await loadStore({
    "recipeace.shopping.v2": '[{"nope":1},"bare string",{"name":"garlic"}]',
  });
  expect(store.shoppingItems()).toEqual([{ name: "garlic" }]);
});
