import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard rails for the responsive pass.
 *
 * These are static checks over the source, not a browser run — they catch the
 * regressions that are easy to reintroduce by hand (a fixed pixel width, a
 * table that forgets its scroll wrapper) without needing a dev server.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({ path: f, text: readFileSync(f, "utf8") }));
const rel = (p: string) => p.slice(SRC.length + 1).replace(/\\/g, "/");

describe("responsive guard rails", () => {
  test("no fixed pixel widths that would overflow a 320px screen", () => {
    // w-[420px] and friends cannot shrink; on the narrowest phone they force
    // a horizontal scrollbar on the whole page.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      for (const m of text.matchAll(/\bw-\[(\d+)px\]/g)) {
        if (Number(m[1]) > 320) offenders.push(rel(path) + ": " + m[0]);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("every table sits inside a horizontal scroll container", () => {
    // A bare <table> with many columns is what blows out the page width.
    const offenders: string[] = [];
    for (const { path, text } of FILES) {
      if (!text.includes("<table")) continue;
      if (!text.includes("overflow-x-auto")) offenders.push(rel(path));
    }
    assert.deepEqual(offenders, []);
  });

  test("the orders table keeps a non-table layout for phones", () => {
    // Its actions (Pay, Reprint, Cancel) are the point of the screen and must
    // not hide behind a horizontal scroll.
    const orders = FILES.find((f) => rel(f.path) === "components/orders/orders-table.tsx");
    assert.ok(orders, "orders-table.tsx not found");
    assert.match(orders!.text, /sm:hidden/, "no mobile card list");
    assert.match(orders!.text, /hidden .*sm:block/, "table is not desktop-only");
  });

  test("interactive controls are reachable on touch devices", () => {
    // The `touch:` variant is how hit areas grow on coarse pointers without
    // loosening desktop density. These are the controls people tap most.
    const mustHaveTouch = [
      "components/ui/button.tsx",
      "components/layout/dashboard-shell.tsx",
      "components/layout/theme-toggle.tsx",
      "components/layout/notification-bell.tsx",
      "components/orders/order-builder.tsx",
      "app/menu/[code]/customer-menu.tsx",
    ];
    for (const target of mustHaveTouch) {
      const file = FILES.find((f) => rel(f.path) === target);
      assert.ok(file, target + " not found");
      assert.match(file!.text, /touch:/, target + " has no touch-sized targets");
    }
  });

  test("the touch variant is declared exactly once", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const declarations = css.match(/@custom-variant touch/g) ?? [];
    assert.equal(declarations.length, 1, "touch variant missing or duplicated");
    assert.match(css, /pointer:\s*coarse/, "touch variant is not pointer-based");
  });

  test("dark mode is declared once and is class-based", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    assert.equal((css.match(/@custom-variant dark/g) ?? []).length, 1);
    assert.match(css, /\.dark/, "no .dark token block");
  });

  test("product images keep their aspect ratio", () => {
    // object-cover inside a fixed aspect box; object-fill would stretch a
    // portrait photo across a landscape card.
    for (const target of ["app/menu/[code]/customer-menu.tsx", "components/orders/order-builder.tsx"]) {
      const file = FILES.find((f) => rel(f.path) === target);
      assert.ok(file, target + " not found");
      assert.match(file!.text, /aspect-\[4\/3\]/, target + " lost its image aspect box");
      assert.ok(!/object-fill/.test(file!.text), target + " stretches images");
    }
  });

  test("the mobile drawer and its trigger are labelled", () => {
    const shell = FILES.find((f) => rel(f.path) === "components/layout/dashboard-shell.tsx");
    assert.ok(shell);
    assert.match(shell!.text, /aria-label="Open navigation"/);
    assert.match(shell!.text, /aria-label="Close navigation"/);
    // The active-nav fix must survive the responsive work.
    assert.match(shell!.text, /aria-current=\{active \? "page" : undefined\}/);
  });

  test("modals scroll their body, not their header", () => {
    const modal = FILES.find((f) => rel(f.path) === "components/ui/modal.tsx");
    assert.ok(modal);
    assert.match(modal!.text, /shrink-0/, "modal header can be scrolled away");
    assert.match(modal!.text, /overflow-y-auto/, "modal body does not scroll");
    assert.match(modal!.text, /max-h-\[92vh\]/, "modal is not height-capped for phones");
  });
});
