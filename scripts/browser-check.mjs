// Browser check against the local test data: logs in through the real form as the super admin,
// opens the key pages in light and dark mode, exercises the confirm dialogs and records any
// console errors / failed requests. Screenshots go to the folder given as 2nd argument.
//   node scripts/with-local-db.mjs node scripts/browser-check.mjs http://localhost:3100 tmp-shots
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/");
const puppeteer = require("puppeteer-core");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs", "test-data", "manifest.json"), "utf8"));
const [base, outArg] = process.argv.slice(2);
const outDir = path.resolve(root, outArg ?? "tmp-shots");
fs.mkdirSync(outDir, { recursive: true });

const superAdmin = manifest.users.find((u) => u.role === "SUPER_ADMIN");
const slug = manifest.projects[0].slug;
const problems = [];
const notes = [];

setTimeout(() => {
  console.error("browser-check: hard timeout");
  process.exit(3);
}, 240000).unref();

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
  timeout: 60000,
});

async function newPage(scheme) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`[${scheme}] console: ${msg.text().slice(0, 200)} @ ${page.url()}`);
  });
  page.on("pageerror", (err) => problems.push(`[${scheme}] pageerror: ${String(err).slice(0, 200)} @ ${page.url()}`));
  page.on("response", (res) => {
    if (res.status() >= 500) problems.push(`[${scheme}] HTTP ${res.status()} ${res.url()}`);
  });
  return page;
}

async function login(page) {
  await page.goto(base + "/login", { waitUntil: "networkidle0" });
  await page.type("#login-username", superAdmin.username);
  await page.type("#login-password", superAdmin.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
    page.click("button[type=submit]"),
  ]);
}

async function shot(page, scheme, name) {
  const file = path.join(outDir, `${scheme}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

async function clickByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const label = await handle.evaluate((el) => (el.textContent ?? "").trim());
    if (label.toLowerCase().includes(text.toLowerCase())) {
      await handle.click();
      return true;
    }
  }
  return false;
}

async function firstTaskHref(page) {
  return page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")).find((h) => /\/board\/[^/?#]+$/.test(h ?? "")) ?? null);
}

try {
  for (const scheme of ["light", "dark"]) {
    const page = await newPage(scheme);
    await login(page);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    notes.push(`${scheme}: <html> has .dark = ${isDark}`);

    await page.goto(`${base}/dashboard`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "dashboard");
    const footer = await page.$eval("footer", (el) => el.textContent?.replace(/\s+/g, " ").trim()).catch(() => null);
    notes.push(`${scheme}: footer = ${footer}`);

    await page.goto(`${base}/admin/logs`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-logs");
    const logsText = await page.evaluate(() => document.body.innerText);
    notes.push(`${scheme}: /admin/logs mentions login.success=${logsText.includes("login.success")}, user.created=${logsText.includes("user.created")}`);

    await page.goto(`${base}/admin/logs?level=WARN`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-logs-warn");
    await page.goto(`${base}/admin/logs?category=project`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-logs-project");
    await page.goto(`${base}/admin/logs?q=zzzznomatchzzzz`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-logs-empty");
    await page.goto(`${base}/admin/logs?page=999`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-logs-far-page");

    await page.goto(`${base}/${slug}/board`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "tasks");
    await page.goto(`${base}/${slug}/board?view=board`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "kanban");

    await page.goto(`${base}/${slug}/board`, { waitUntil: "networkidle0" });
    const href = await firstTaskHref(page);
    if (href) {
      await page.goto(base + href, { waitUntil: "networkidle0" });
      await shot(page, scheme, "task-detail");

      // confirm dialog from a comment delete button
      const opened = await clickByText(page, "button", "delete");
      if (opened) {
        await new Promise((r) => setTimeout(r, 400));
        const dialog = await page.$("[role=dialog], [role=alertdialog], dialog[open]");
        notes.push(`${scheme}: confirm dialog appeared on task page = ${!!dialog}`);
        if (dialog) {
          const info = await page.evaluate(() => {
            const d = document.querySelector("[role=dialog], [role=alertdialog], dialog[open]");
            const active = document.activeElement;
            return {
              ariaModal: d?.getAttribute("aria-modal"),
              labelled: !!(d?.getAttribute("aria-labelledby") || d?.getAttribute("aria-label")),
              focusInside: !!d?.contains(active),
              activeTag: active?.tagName,
              bodyOverflow: getComputedStyle(document.body).overflow,
            };
          });
          notes.push(`${scheme}: dialog info = ${JSON.stringify(info)}`);
          await shot(page, scheme, "confirm-dialog");
          await page.keyboard.press("Escape");
          await new Promise((r) => setTimeout(r, 300));
          const stillOpen = await page.$("[role=dialog], [role=alertdialog], dialog[open]");
          notes.push(`${scheme}: Escape closes dialog = ${!stillOpen}`);
        }
      } else {
        notes.push(`${scheme}: no delete button found on first task page`);
      }
    } else {
      notes.push(`${scheme}: no task link found`);
    }

    await page.goto(`${base}/${slug}/settings`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "settings");
    await page.goto(`${base}/admin`, { waitUntil: "networkidle0" });
    await shot(page, scheme, "admin-console");
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("\n--- notes ---");
for (const n of notes) console.log(n);
console.log("\n--- problems (" + problems.length + ") ---");
for (const p of problems) console.log(p);
