import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard rails for Admin User Management.
 *
 * Static checks over the route sources, like the responsive guards: they catch
 * the regressions that matter most here — an endpoint losing its admin gate, a
 * self-delete or last-admin check being dropped, or the service-role client
 * leaking into code that ships to the browser.
 */
const SRC = join(process.cwd(), "src");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

const COLLECTION = read("app", "api", "admin", "users", "route.ts");
const MEMBER = read("app", "api", "admin", "users", "[id]", "route.ts");
const RESET = read("app", "api", "admin", "users", "[id]", "reset-password", "route.ts");

/** Body of one exported HTTP handler, up to the next top-level export. */
function handler(source: string, method: string): string {
  const start = source.indexOf(`export async function ${method}(`);
  assert.ok(start >= 0, `${method} handler not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("user management API authorization", () => {
  const handlers: [string, string][] = [
    ["POST /api/admin/users", handler(COLLECTION, "POST")],
    ["PATCH /api/admin/users/[id]", handler(MEMBER, "PATCH")],
    ["DELETE /api/admin/users/[id]", handler(MEMBER, "DELETE")],
    ["POST /api/admin/users/[id]/reset-password", handler(RESET, "POST")],
  ];

  for (const [name, body] of handlers) {
    test(`${name} is gated to admins before doing anything`, () => {
      const gate = body.indexOf('requireRole(["admin"])');
      assert.ok(gate >= 0, `${name} is not gated with requireRole(["admin"])`);
      // The privileged client must never be created before the gate passes.
      const privileged = body.indexOf("createAdminClient()");
      assert.ok(privileged === -1 || privileged > gate, `${name} builds the service-role client before checking the role`);
      assert.match(body, /if \(!guard\.ok\)/, `${name} ignores the guard result`);
    });
  }

  test("roles are validated against the four known values", () => {
    for (const source of [COLLECTION, MEMBER]) {
      assert.match(source, /VALID_ROLES: AppRole\[\] = \["admin", "cashier", "kitchen", "waiter"\]/);
    }
  });
});

describe("user management safety rules", () => {
  const del = handler(MEMBER, "DELETE");
  const patch = handler(MEMBER, "PATCH");

  test("an admin cannot delete their own account", () => {
    assert.match(del, /id === guard\.user\.id/);
    assert.match(del, /cannot delete your own account/);
  });

  test("an admin cannot demote or deactivate themselves", () => {
    assert.match(patch, /cannot change your own role/);
    assert.match(patch, /cannot deactivate your own account/);
  });

  test("the last active admin cannot be deleted", () => {
    assert.match(del, /\.eq\("role", "admin"\)/);
    assert.match(del, /\.eq\("active", true\)/);
    assert.match(del, /last active admin/);
  });

  test("deletion revokes sign-in before removing the profile", () => {
    // Removing the auth row first means a half-finished delete leaves the
    // account locked out rather than still usable.
    const auth = del.indexOf("auth.admin.deleteUser");
    const profile = del.indexOf('from("profiles").delete()');
    assert.ok(auth >= 0 && profile >= 0, "delete does not remove both the auth user and the profile");
    assert.ok(auth < profile, "profile is removed before sign-in is revoked");
  });
});

describe("service-role isolation", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (/\.tsx?$/.test(full) && !full.includes("__tests__")) out.push(full);
    }
    return out;
  }

  test("no client component imports the service-role client", () => {
    const offenders = walk(SRC)
      .map((f) => ({ f, text: readFileSync(f, "utf8") }))
      .filter(({ text }) => /^\s*["']use client["']/.test(text) && /supabase\/admin/.test(text))
      .map(({ f }) => f.slice(SRC.length + 1));
    assert.deepEqual(offenders, []);
  });

  test("the service-role module is server-only", () => {
    assert.match(read("lib", "supabase", "admin.ts"), /import "server-only"/);
  });
});
