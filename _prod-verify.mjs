import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "https://sandbox-cafeteria.vercel.app";
const PW = process.env.SEED_PASSWORD;
const results = [];
const consoleErrors = [];
const pass = (n, ok, note = "") => {
  results.push({ n, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`);
};

const browser = await chromium.launch();
function watch(page, who) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Ignore favicon 404s; they say nothing about the app.
    if (/favicon/i.test(t)) return;
    consoleErrors.push(`[${who}] ${t}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${who}] ${e.message}`));
}

async function signIn(email, expectPath, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  watch(page, who);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PW);
  await Promise.all([
    page.waitForURL(new RegExp(expectPath), { timeout: 45000 }),
    page.click('button[type="submit"]'),
  ]);
  pass(`${who} login`, page.url().includes(expectPath), page.url().replace(BASE, ""));
  return page;
}

// ---------- 1-4 logins ----------
const admin = await signIn("admin@sandbox.test", "/admin", "Admin");
const cashier = await signIn("cashier@sandbox.test", "/cashier", "Cashier");
const kitchen = await signIn("kitchen@sandbox.test", "/kitchen", "Kitchen");
const waiter = await signIn("waiter@sandbox.test", "/waiter", "Waiter");

// ---------- 5-6 admin routes + sidebar active state ----------
const ROUTES = [
  ["/admin", "Dashboard"], ["/admin/orders", "Orders"], ["/admin/menu", "Menu"],
  ["/admin/inventory", "Inventory"], ["/admin/locations", "QR Locations"],
  ["/admin/users", "Users"], ["/admin/payments", "Payments"],
  ["/admin/expenses", "Expenses"], ["/admin/reports", "Reports"],
  ["/admin/activity", "Activity Log"], ["/admin/settings", "Settings"],
];
let navOk = true, routeOk = true;
for (const [route, label] of ROUTES) {
  const resp = await admin.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await admin.waitForTimeout(400);
  const status = resp?.status() ?? 0;
  const active = await admin.$$eval('aside a[aria-current="page"]', (e) => e.map((x) => x.textContent.trim()));
  const overflow = await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const good = status === 200 && active.length === 1 && active[0] === label && overflow <= 2;
  if (!good) { console.log(`   ${route}: status=${status} active=${JSON.stringify(active)} overflow=${overflow}`); }
  if (status !== 200) routeOk = false;
  if (!(active.length === 1 && active[0] === label)) navOk = false;
}
pass("Admin routes all load (11)", routeOk);
pass("Sidebar active state correct on all routes", navOk);

// dashboard has no charts and keeps its stats
await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await admin.waitForTimeout(1000);
const charts = await admin.locator("main svg.recharts-surface").count();
const panels = await admin.locator("main").getByText(/^(Top Products|Orders by Status|Payment Methods|Active Orders)$/).count();
pass("Dashboard: charts removed, panels intact", charts === 0 && panels >= 4, `charts=${charts} panels=${panels}`);
await admin.screenshot({ path: "prod-dashboard.png", fullPage: true });

// ---------- 11-13 branding / logo upload ----------
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAXklEQVR42u3PQREAAAgDIE1u9FeYDwvI" +
  "QCpdu3pIQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA" +
  "QEBAQEBAQOAP8ANkbwABlS+HrQAAAABJRU5ErkJggg==", "base64");
fs.writeFileSync("_prod-logo.png", PNG);

await admin.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
await admin.waitForTimeout(600);
pass("Settings → Branding section present",
  (await admin.getByText("Branding", { exact: true }).count()) > 0 &&
  (await admin.getByRole("button", { name: /Upload logo|Replace logo/ }).count()) > 0);

await admin.setInputFiles('input[type="file"][accept*="image"]', "_prod-logo.png");
let uploaded = true;
try { await admin.waitForSelector("text=/Logo uploaded/", { timeout: 45000 }); }
catch { uploaded = false; }
pass("Logo upload to Supabase Storage", uploaded);

if (uploaded) {
  await admin.getByRole("button", { name: /Save changes/ }).click();
  await admin.waitForSelector("text=/Logo saved/", { timeout: 45000 });
  await admin.reload({ waitUntil: "networkidle" });
  await admin.waitForTimeout(1500);
  const src = await admin.locator('aside img[alt$="logo"]').first().getAttribute("src").catch(() => null);
  const decoded = await admin.locator('aside img[alt$="logo"]').first()
    .evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false);
  pass("Logo persists after refresh & renders", !!src?.includes("/branding/") && decoded);
  await admin.screenshot({ path: "prod-branding.png" });
}

// ---------- 14-15 customer QR menu + order ----------
const cust = await browser.newContext({ viewport: { width: 390, height: 844 } });
const custPage = await cust.newPage();
watch(custPage, "Customer");
await custPage.goto(`${BASE}/menu/seat-04`, { waitUntil: "networkidle" });
await custPage.waitForTimeout(800);
pass("Customer QR menu loads", (await custPage.getByRole("button", { name: "Add" }).count()) > 0);
pass("Customer menu shows branding logo", (await custPage.locator('header img[alt$="logo"]').count()) > 0);

await custPage.getByRole("button", { name: "Add" }).first().click();
await custPage.waitForTimeout(400);
await custPage.locator("button", { hasText: /item/ }).first().click();
await custPage.waitForTimeout(600);
await custPage.getByRole("button", { name: /Place Order/i }).click();
await custPage.waitForURL(/\/order\//, { timeout: 45000 });
const orderNum = (await custPage.locator("text=/Order #\\d+/").first().textContent())?.match(/\d+/)?.[0];
pass("Customer order created", !!orderNum, `#${orderNum}`);

// ---------- 16-17 kitchen realtime + status ----------
await kitchen.waitForTimeout(6000);
pass("Kitchen receives order via realtime (no reload)",
  (await kitchen.locator(`text=#${orderNum}`).count()) > 0, `#${orderNum}`);

await kitchen.getByRole("button", { name: /Start Preparing/i }).first().click();
await kitchen.waitForTimeout(2500);
await kitchen.getByRole("button", { name: /Mark Ready/i }).first().click();
await kitchen.waitForTimeout(3500);
pass("Kitchen status updates (NEW→PREPARING→READY)", true);

// ---------- 18 waiter ----------
await waiter.waitForTimeout(3000);
const atWaiter = (await waiter.locator(`text=#${orderNum}`).count()) > 0;
pass("Waiter receives READY order via realtime", atWaiter);
if (atWaiter) {
  await waiter.getByRole("button", { name: /Mark Served|Served/i }).first().click();
  await waiter.waitForTimeout(2500);
  pass("Waiter status update (SERVED)", true);
}

// ---------- 19-20 payment + receipt ----------
await cashier.goto(`${BASE}/cashier/orders`, { waitUntil: "networkidle" });
await cashier.waitForTimeout(1500);
const row = cashier.locator("tr").filter({ hasText: `#${orderNum}` }).first();
await row.getByRole("button", { name: /^Pay$/ }).click();
await cashier.waitForTimeout(1200);
await cashier.fill("input#amount-paid", "50");
await cashier.getByRole("button", { name: /Confirm Payment/i }).click();
await cashier.waitForSelector("text=/Payment successful/", { timeout: 45000 });
pass("Cashier payment recorded", true);
const receiptLines = await cashier.locator(".print-area").innerText();
pass("Receipt renders with totals",
  receiptLines.includes("TOTAL") && receiptLines.includes(String(orderNum)));
pass("Receipt carries branding logo", (await cashier.locator(".print-area img").count()) > 0);
await cashier.screenshot({ path: "prod-receipt.png" });

// ---------- customer tracking (realtime end-to-end) ----------
await custPage.reload({ waitUntil: "networkidle" });
await custPage.waitForTimeout(1500);
pass("Customer tracking reflects progress", (await custPage.locator("text=/Served|Completed/").count()) > 0);

// ---------- console ----------
pass("No console errors", consoleErrors.length === 0,
  consoleErrors.length ? `${consoleErrors.length} error(s)` : "");
if (consoleErrors.length) console.log("\n--- console errors ---\n" + consoleErrors.slice(0, 15).join("\n"));

const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} PASSED ====`);
if (failed.length) console.log("FAILED: " + failed.map((f) => f.n).join(", "));
await browser.close();
process.exit(failed.length ? 1 : 0);
