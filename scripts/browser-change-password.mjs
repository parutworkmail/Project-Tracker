// Reproduces the real flow in a browser: log in as a user who must change password,
// submit the change-password form, and report where the browser ends up.
//   node scripts/with-local-db.mjs node scripts/browser-change-password.mjs http://localhost:3100 <username> <tempPassword>
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire("C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/");
const puppeteer = require("puppeteer-core");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [base, username, tempPassword] = process.argv.slice(2);
const newPassword = "Brand-New-Passw0rd!";
const outDir = path.join(root, "tmp-shots");
fs.mkdirSync(outDir, { recursive: true });

setTimeout(() => { console.error("hard timeout"); process.exit(3); }, 120000).unref();

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const pathOf = () => new URL(page.url()).pathname;

await page.goto(base + "/login", { waitUntil: "networkidle0" });
await page.type("#login-username", username);
await page.type("#login-password", tempPassword);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {}),
  page.click("button[type=submit]"),
]);
await new Promise((r) => setTimeout(r, 1500));
console.log("after login        ->", pathOf());
for (let i = 0; i < 6 && pathOf() !== "/change-password"; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  console.log("  waiting          ->", pathOf());
}
await page.screenshot({ path: path.join(outDir, "change-password-landing.png"), fullPage: true });
console.log("h1 on landing      ->", await page.$eval("h1", (el) => el.textContent).catch(() => null));
await page.waitForSelector("#change-password-new", { timeout: 5000 });

await page.type("#change-password-new", newPassword);
await page.type("#change-password-confirm", newPassword);
await page.click("button[type=submit]");
for (let i = 0; i < 10 && pathOf() === "/change-password"; i++) {
  await new Promise((r) => setTimeout(r, 1000));
}
await new Promise((r) => setTimeout(r, 1500));
console.log("after submit       ->", pathOf());
await page.screenshot({ path: path.join(outDir, "change-password-result.png"), fullPage: true });
const heading = await page.$eval("h1", (el) => el.textContent).catch(() => null);
console.log("page heading       ->", heading);
console.log(pathOf() === "/dashboard" ? "RESULT: PASS (reached dashboard)" : "RESULT: FAIL (still on " + pathOf() + ")");

await page.reload({ waitUntil: "networkidle0" });
console.log("after hard reload  ->", pathOf());
await browser.close();
