import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeLocationCode } from "../location-code";

describe("QR location management", () => {
  test("normalizes human-entered location codes into stable URL slugs", () => {
    assert.equal(normalizeLocationCode("  Main Hall 09  "), "main-hall-09");
    assert.equal(normalizeLocationCode("table___12"), "table-12");
    assert.equal(normalizeLocationCode("seat---07"), "seat-07");
  });

  test("rejects location codes that contain no URL-safe characters", () => {
    assert.equal(normalizeLocationCode("   "), null);
    assert.equal(normalizeLocationCode("!!!"), null);
    assert.equal(normalizeLocationCode("---"), null);
  });

  test("location cards expose translated names for every icon-only action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/locations/locations-manager.tsx"),
      "utf8"
    );

    for (const key of ["viewQrLabel", "activateLabel", "deactivateLabel", "editLabel", "deleteLabel"]) {
      assert.match(source, new RegExp(`locations\\.${key}`), `${key} is not wired to the location card`);
    }
  });

  test("the location editor uses native form submission and required fields", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/admin/locations/location-modal.tsx"),
      "utf8"
    );

    assert.match(source, /<form[^>]+onSubmit=\{submit\}/);
    assert.match(source, /id="l-name" required/);
    assert.match(source, /id="l-code" required/);
    assert.match(source, /type="submit"/);
  });
});
