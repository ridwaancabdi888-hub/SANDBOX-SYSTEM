import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src", "components", "layout", "notification-bell.tsx"),
  "utf8"
);

describe("notification bell accessibility", () => {
  test("the trigger exposes the panel state and unread count", () => {
    assert.match(source, /const plural = usePlural\(\)/);
    assert.match(source, /plural\("notifications\.unreadCount", unreadCount\)/);
    assert.match(source, /aria-controls=\{panelId\}/);
    assert.match(source, /aria-expanded=\{open\}/);
    assert.match(source, /aria-hidden="true"/);
  });

  test("the panel is a labelled region", () => {
    assert.match(source, /id=\{panelId\}/);
    assert.match(source, /role="region"/);
    assert.match(source, /aria-labelledby=\{headingId\}/);
    assert.match(source, /id=\{headingId\}/);
  });

  test("Escape closes the panel and restores trigger focus", () => {
    assert.match(source, /e\.key !== "Escape"/);
    assert.match(source, /setOpen\(false\)/);
    assert.match(source, /triggerRef\.current\?\.focus\(\)/);
    assert.match(source, /document\.addEventListener\("keydown", onKeyDown\)/);
    assert.match(source, /document\.removeEventListener\("keydown", onKeyDown\)/);
  });

  test("icon-only panel actions have translated accessible names", () => {
    assert.match(
      source,
      /aria-label=\{soundEnabled \? t\("notifications\.muteSound"\) : t\("notifications\.enableSound"\)\}/
    );
    assert.match(source, /aria-label=\{t\("notifications\.markAllRead"\)\}/);
  });
});
