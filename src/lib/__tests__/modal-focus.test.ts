import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { containModalFocus, focusModal, restoreModalFocus } from "../modal-focus";

function focusFixture(count = 2) {
  let focused: number | "panel" | null = null;
  let prevented = false;
  const elements = Array.from({ length: count }, (_, index) => ({
    hidden: false,
    hasAttribute: () => false,
    getAttribute: () => null,
    focus: () => {
      focused = index;
    },
  })) as unknown as HTMLElement[];
  const panel = {
    querySelectorAll: () => elements,
    querySelector: () => null,
    contains: (element: Element | null) => elements.includes(element as HTMLElement),
    focus: () => {
      focused = "panel";
    },
  } as unknown as HTMLElement;
  const event = (shiftKey = false) => ({
    key: "Tab",
    shiftKey,
    preventDefault: () => {
      prevented = true;
    },
  });

  return {
    elements,
    panel,
    event,
    result: () => ({ focused, prevented }),
  };
}

describe("shared modal focus management", () => {
  test("initial focus falls back to the first interactive control", () => {
    const fixture = focusFixture();
    assert.equal(focusModal(fixture.panel), fixture.elements[0]);
    assert.deepEqual(fixture.result(), { focused: 0, prevented: false });
  });

  test("Tab and Shift+Tab wrap at the dialog boundaries", () => {
    const forward = focusFixture();
    assert.equal(
      containModalFocus(forward.event(), forward.panel, forward.elements[1]),
      true
    );
    assert.deepEqual(forward.result(), { focused: 0, prevented: true });

    const backward = focusFixture();
    assert.equal(
      containModalFocus(backward.event(true), backward.panel, backward.elements[0]),
      true
    );
    assert.deepEqual(backward.result(), { focused: 1, prevented: true });
  });

  test("an empty dialog receives focus itself", () => {
    const fixture = focusFixture(0);
    assert.equal(focusModal(fixture.panel), fixture.panel);
    assert.deepEqual(fixture.result(), { focused: "panel", prevented: false });
  });

  test("focus restoration ignores a trigger removed from the page", () => {
    let focused = false;
    const connected = {
      isConnected: true,
      focus: () => {
        focused = true;
      },
    } as unknown as HTMLElement;
    const removed = {
      isConnected: false,
      focus: () => {
        throw new Error("removed trigger must not receive focus");
      },
    } as unknown as HTMLElement;

    assert.equal(restoreModalFocus(connected), true);
    assert.equal(focused, true);
    assert.equal(restoreModalFocus(removed), false);
    assert.equal(restoreModalFocus(null), false);
  });

  test("the shared component wires dialog labels and focus helpers", () => {
    const modal = readFileSync(
      join(process.cwd(), "src", "components", "ui", "modal.tsx"),
      "utf8"
    );
    const confirm = readFileSync(
      join(process.cwd(), "src", "components", "ui", "confirm-dialog.tsx"),
      "utf8"
    );

    assert.match(modal, /aria-labelledby=\{title \? titleId : undefined\}/);
    assert.match(modal, /aria-describedby=\{description \? descriptionId : undefined\}/);
    assert.match(modal, /containModalFocus\(event, panelRef\.current, document\.activeElement\)/);
    assert.match(modal, /restoreModalFocus\(restoreFocusTo\.current\)/);
    assert.match(confirm, /ariaLabel=\{state\?\.options\.title\}/);
  });
});
