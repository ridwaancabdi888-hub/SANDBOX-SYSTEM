// One-time dev seed script: creates the four demo staff accounts using the
// Supabase Auth Admin API. Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Run with: node scripts/seed-users.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Read from the environment rather than hardcoded: these accounts exist on the
// live deployment, so a literal password in this file would be a working set of
// admin credentials published in the repository.
const password = process.env.SEED_PASSWORD;
if (!password) {
  console.error(
    "Missing SEED_PASSWORD. Add it to .env.local (or export it) before seeding,\n" +
      "e.g. SEED_PASSWORD=choose-a-strong-password"
  );
  process.exit(1);
}

const DEMO_USERS = [
  { email: "admin@sandbox.test", full_name: "Amina Admin", role: "admin", password },
  { email: "cashier@sandbox.test", full_name: "Cade Cashier", role: "cashier", password },
  { email: "kitchen@sandbox.test", full_name: "Kim Kitchen", role: "kitchen", password },
  { email: "waiter@sandbox.test", full_name: "Wale Waiter", role: "waiter", password },
];

for (const u of DEMO_USERS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });
  if (error) {
    if (error.message.includes("already been registered") || error.status === 422) {
      console.log(`SKIP  ${u.email} (already exists)`);
      continue;
    }
    console.error(`FAIL  ${u.email}:`, error.message);
    continue;
  }
  console.log(`OK    ${u.email} (${u.role}) -> ${data.user.id}`);
}

console.log("\nAccounts created with the password from SEED_PASSWORD:");
for (const u of DEMO_USERS) {
  console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}
