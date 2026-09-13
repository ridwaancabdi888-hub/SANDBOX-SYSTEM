import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ALL_CATEGORY, buildMenuFilter, type CategoryWithProducts } from "../menu-filter";

const product = (id: string, name = id) =>
  ({ id, name, price: 1, available: true }) as unknown as CategoryWithProducts["products"][number];

const CATEGORIES = [
  { id: "tea", name: "Tea", products: [product("t1")] },
  { id: "food", name: "Food", products: [product("f1"), product("f2")] },
  { id: "coffee", name: "Coffee", products: [product("c1"), product("c2")] },
  { id: "empty", name: "Empty", products: [] },
] as unknown as CategoryWithProducts[];

describe("menu ALL filter", () => {
  test("ALL returns every available product across categories", () => {
    const menu = buildMenuFilter(CATEGORIES, ALL_CATEGORY);
    assert.deepEqual(
      menu.products.map((p) => p.id),
      ["t1", "f1", "f2", "c1", "c2"]
    );
    assert.equal(menu.allCount, 5);
  });

  test("ALL count matches the number of products actually rendered", () => {
    const menu = buildMenuFilter(CATEGORIES, ALL_CATEGORY);
    assert.equal(menu.allCount, menu.products.length, "pill count would lie");
  });

  test("selecting a category narrows to just that category", () => {
    assert.deepEqual(
      buildMenuFilter(CATEGORIES, "food").products.map((p) => p.id),
      ["f1", "f2"]
    );
    assert.deepEqual(
      buildMenuFilter(CATEGORIES, "tea").products.map((p) => p.id),
      ["t1"]
    );
  });

  test("returning to ALL restores the full list", () => {
    const narrowed = buildMenuFilter(CATEGORIES, "tea");
    const back = buildMenuFilter(CATEGORIES, ALL_CATEGORY);
    assert.equal(narrowed.products.length, 1);
    assert.equal(back.products.length, 5);
  });

  test("a product in two categories is never listed twice under ALL", () => {
    const shared = product("shared");
    const cats = [
      { id: "a", name: "A", products: [shared] },
      { id: "b", name: "B", products: [shared] },
    ] as unknown as CategoryWithProducts[];
    const menu = buildMenuFilter(cats, ALL_CATEGORY);
    assert.equal(menu.products.length, 1);
    assert.equal(menu.allCount, 1);
  });

  test("empty categories are dropped so no pill is a dead end", () => {
    const menu = buildMenuFilter(CATEGORIES, ALL_CATEGORY);
    assert.deepEqual(menu.categories.map((c) => c.id), ["tea", "food", "coffee"]);
  });

  test("an unknown category id falls back to ALL rather than an empty grid", () => {
    // A category deactivated while the page was open.
    const menu = buildMenuFilter(CATEGORIES, "deleted-category");
    assert.equal(menu.activeId, ALL_CATEGORY);
    assert.equal(menu.products.length, 5);
  });

  test("selecting an empty category falls back to ALL", () => {
    const menu = buildMenuFilter(CATEGORIES, "empty");
    assert.equal(menu.activeId, ALL_CATEGORY);
    assert.equal(menu.products.length, 5);
  });

  test("activeId reflects the selected category so exactly one pill lights up", () => {
    assert.equal(buildMenuFilter(CATEGORIES, "coffee").activeId, "coffee");
    assert.equal(buildMenuFilter(CATEGORIES, ALL_CATEGORY).activeId, ALL_CATEGORY);
  });

  test("an entirely empty menu yields no pills and no products", () => {
    const menu = buildMenuFilter([], ALL_CATEGORY);
    assert.deepEqual(menu.categories, []);
    assert.deepEqual(menu.products, []);
    assert.equal(menu.allCount, 0);
  });

  test("ALL is not a real category id", () => {
    assert.ok(!CATEGORIES.some((c) => c.id === ALL_CATEGORY));
  });
});
