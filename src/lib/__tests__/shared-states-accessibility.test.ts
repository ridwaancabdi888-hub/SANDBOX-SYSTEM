import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src", "components", "ui", "states.tsx"),
  "utf8"
);

describe("shared state accessibility", () => {
  test("loading and error messages are announced to assistive technology", () => {
    assert.match(source, /role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/);
    assert.match(source, /role="alert"[\s\S]*?aria-atomic="true"/);
  });

  test("decorative state visuals stay out of the accessibility tree", () => {
    assert.match(source, /<Loader2\s+[\s\S]*?aria-hidden="true"/);
    assert.match(source, /<AlertCircle aria-hidden="true"/);
    assert.match(source, /<RefreshCw aria-hidden="true"/);
    assert.match(source, /return <div aria-hidden="true" className=\{cn\("animate-pulse/);
  });
});
