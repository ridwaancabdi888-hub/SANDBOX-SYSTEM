import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { activeNavHref } from "../nav-active";

const ADMIN = [
  "/admin",
  "/admin/orders",
  "/admin/menu",
  "/admin/inventory",
  "/admin/locations",
  "/admin/users",
  "/admin/payments",
  "/admin/expenses",
  "/admin/reports",
  "/admin/activity",
  "/admin/settings",
].map((href) => ({ href }));

describe("sidebar active route", () => {
  test("the section index is active only on the index itself", () => {
    assert.equal(activeNavHref("/admin", ADMIN), "/admin");
  });

  test("a sub-route never leaves the section index highlighted", () => {
    // The bug this replaced: `startsWith("/admin/")` lit up Dashboard on
    // every single admin page.
    for (const href of ADMIN.map((i) => i.href).filter((h) => h !== "/admin")) {
      assert.equal(activeNavHref(href, ADMIN), href, `${href} resolved to the wrong nav item`);
    }
  });

  test("nested routes resolve to their section", () => {
    assert.equal(activeNavHref("/admin/menu/123", ADMIN), "/admin/menu");
    assert.equal(activeNavHref("/admin/orders/abc/edit", ADMIN), "/admin/orders");
    assert.equal(activeNavHref("/admin/settings/printers", ADMIN), "/admin/settings");
  });

  test("prefixes only match on a segment boundary", () => {
    const items = [{ href: "/admin" }, { href: "/admin/order" }];
    assert.equal(activeNavHref("/admin/orders", items), "/admin");
  });

  test("trailing slashes resolve the same way", () => {
    assert.equal(activeNavHref("/admin/menu/", ADMIN), "/admin/menu");
  });

  test("an unknown route matches the section index, not an arbitrary item", () => {
    assert.equal(activeNavHref("/admin/unknown-page", ADMIN), "/admin");
  });

  test("a route outside the section matches nothing", () => {
    assert.equal(activeNavHref("/cashier/orders", ADMIN), null);
  });

  test("works for the other role sections", () => {
    const cashier = ["/cashier", "/cashier/orders", "/cashier/payments", "/cashier/printer"].map(
      (href) => ({ href })
    );
    assert.equal(activeNavHref("/cashier", cashier), "/cashier");
    assert.equal(activeNavHref("/cashier/printer", cashier), "/cashier/printer");

    const waiter = [{ href: "/waiter" }, { href: "/waiter/new-order" }];
    assert.equal(activeNavHref("/waiter/new-order", waiter), "/waiter/new-order");
    assert.equal(activeNavHref("/waiter", waiter), "/waiter");
  });
});
