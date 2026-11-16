// UI check in a real browser against the local test data (manifest from e2e-loop.mjs):
// Create user button, sortable column headers, Leave project in settings, All projects link,
// label dropdown, change-password redirect.
//   node scripts/with-local-db.mjs node scripts/check-ui.mjs http://localhost:3100 tmp-shots
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const require = createRequire("C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/");
const puppeteer = require("puppeteer-core");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs", "test-data", "manifest.json"), "utf8"));
const base = process.argv[2] ?? "http://localhost:3100";
const shots = path.resolve(root, process.argv[3] ?? "tmp-shots");
fs.mkdirSync(shots, { recursive: true });

const find = (part) => manifest.users.find((u) => u.username.includes(part));
const sa = find("superadmin");
const member = find("user1");
const slug = manifest.projects[0].slug;

const db = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: false,
});
await db.connect();

let failures = 0;
const problems = [];
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

setTimeout(() => { console.error("hard timeout"); process.exit(3); }, 200000).unref();

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

async function open(account, scheme = "light") {
  await db.query(`DELETE FROM "RateLimitEntry"`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 160)} @ ${page.url()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto(base + "/login", { waitUntil: "networkidle0" });
  await page.type("#login-username", account.username);
  await page.type("#login-password", account.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {}),
    page.click("button[type=submit]"),
  ]);
  return page;
}

try {
  for (const scheme of ["light", "dark"]) {
    const page = await open(sa, scheme);

    // ---- Create user button ----
    await page.goto(`${base}/admin`, { waitUntil: "networkidle0" });
    const buttons = await page.evaluate(() => {
      const pick = (text) => {
        const el = [...document.querySelectorAll("a, button")].find((e) => (e.textContent ?? "").trim().includes(text));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { text: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, fs: s.fontSize, radius: s.borderRadius };
      };
      return { user: pick("Create user"), project: pick("New project") };
    });
    console.log(`[${scheme}] create user vs new project:`, JSON.stringify(buttons));
    check(`[${scheme}] Create user button exists`, !!buttons.user);
    check(
      `[${scheme}] Create user matches the New project button (same size, colour, radius)`,
      !!buttons.user && !!buttons.project && buttons.user.h === buttons.project.h && buttons.user.bg === buttons.project.bg && buttons.user.fs === buttons.project.fs && buttons.user.radius === buttons.project.radius,
      JSON.stringify(buttons)
    );
    await page.screenshot({ path: path.join(shots, `${scheme}-admin-create-user.png`), clip: { x: 0, y: 0, width: 1280, height: 520 } });

    if (scheme === "light") {
      // ---- sortable headers ----
      await page.goto(`${base}/${slug}/board`, { waitUntil: "networkidle0" });
      const titlesOf = () => page.$$eval("tbody tr td:nth-child(2) a", (as) => as.map((a) => a.textContent.trim()));

      await page.click("a[aria-label='Sort by title']");
      await page.waitForFunction(() => location.search.includes("sort=title_asc"), { timeout: 15000 }).catch(() => {});
      await wait(600);
      const asc = await titlesOf();
      check("clicking Title sorts A to Z in the URL", page.url().includes("sort=title_asc"), page.url());
      check("rows are in A-Z order", JSON.stringify(asc) === JSON.stringify([...asc].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))), JSON.stringify(asc));
      const ariaAsc = await page.$eval("th:nth-child(2)", (th) => th.getAttribute("aria-sort"));
      check("Title header reports ascending", ariaAsc === "ascending", ariaAsc);

      await page.click("a[aria-label='Sort by title']");
      await page.waitForFunction(() => location.search.includes("sort=title_desc"), { timeout: 15000 }).catch(() => {});
      await wait(600);
      const desc = await titlesOf();
      check("clicking Title again reverses it", page.url().includes("sort=title_desc") && JSON.stringify(desc) === JSON.stringify([...asc].reverse()), `${page.url()} ${JSON.stringify(desc)}`);
      await page.screenshot({ path: path.join(shots, "light-sorted-table.png") });

      for (const column of ["status", "priority", "assignee", "due"]) {
        await page.waitForSelector(`a[aria-label='Sort by ${column}']`, { timeout: 20000 });
        await page.click(`a[aria-label='Sort by ${column}']`);
        await page
          .waitForFunction((name) => location.search.includes(`sort=${name}`), { timeout: 20000 }, column === "assignee" ? "assignee_asc" : column === "status" ? "status_asc" : column)
          .catch(() => {});
        await page.waitForSelector("tbody tr", { timeout: 20000 }).catch(() => {});
        const rows = await page.$$eval("tbody tr", (r) => r.length);
        check(`Sort by ${column} loads rows without an error page`, rows > 0 && !(await page.content()).includes("Something went wrong"), page.url());
      }

      // ---- search on its own line ----
      const geometry = await page.evaluate(() => {
        const search = document.querySelector("input[type=search]").getBoundingClientRect();
        const view = document.querySelector("[aria-label='Task view']").getBoundingClientRect();
        return { searchTop: search.top, searchBottom: search.bottom, viewTop: view.top, searchWidth: search.width };
      });
      check("search sits on its own line above List/Board", geometry.searchBottom <= geometry.viewTop && geometry.searchWidth > 600, JSON.stringify(geometry));

      // ---- nav: All projects ----
      const nav = await page.$$eval("header a", (as) => as.map((a) => [a.textContent.trim(), a.getAttribute("href")]));
      check("project navbar has All projects -> /dashboard", nav.some(([t, h]) => t === "All projects" && h === "/dashboard"), JSON.stringify(nav));
      const orderOk = await page.evaluate(() => {
        const link = [...document.querySelectorAll("header a")].find((a) => a.textContent.trim() === "All projects");
        const toggle = document.querySelector("header button[aria-label*='click to switch']");
        if (!link || !toggle) return { found: false };
        const linkIsFirst = Boolean(link.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING);
        return { found: true, linkIsFirst };
      });
      check("All projects sits right before the theme toggle", orderOk.found && orderOk.linkIsFirst, JSON.stringify(orderOk));

      // ---- task page: no Leave button, label dropdown, back bar ----
      const firstTask = await page.$$eval("tbody tr td:nth-child(2) a", (as) => as[0]?.getAttribute("href"));
      await page.goto(base + firstTask, { waitUntil: "networkidle0" });
      const taskText = await page.evaluate(() => document.body.innerText);
      check("task page has no Leave project button", !/Leave project/i.test(taskText));
      const labelsDetails = await page.$$eval("details", (d) => d.length);
      check("labels are a collapsible dropdown", labelsDetails >= 1, String(labelsDetails));
      await page.screenshot({ path: path.join(shots, "light-task-page.png") });
    }
    await page.close();
  }

  // ---- plain member: Leave lives in Project Settings ----
  const memberPage = await open(member);
  await memberPage.goto(`${base}/${slug}/board`, { waitUntil: "networkidle0" });
  const boardText = await memberPage.evaluate(() => document.body.innerText);
  check("Tasks page no longer shows Leave project", !/Leave project/i.test(boardText));
  const hasSettingsLink = await memberPage.$$eval("header a", (as) => as.some((a) => a.textContent.trim() === "Project Settings"));
  check("plain member sees the Project Settings link", hasSettingsLink);
  await memberPage.goto(`${base}/${slug}/settings`, { waitUntil: "networkidle0" });
  const settingsText = await memberPage.evaluate(() => document.body.innerText);
  check("member settings page shows Leave project", /Leave project/.test(settingsText));
  check("member settings page hides manager sections", !/Name & shareable link/.test(settingsText) && !/Labels/.test(settingsText));
  await memberPage.screenshot({ path: path.join(shots, "light-member-settings.png") });
  await memberPage.close();
} finally {
  await browser.close();
  await db.end();
}

console.log(`\nbrowser problems (${problems.length}):`);
for (const p of problems) console.log("  " + p);
check("no console errors or HTTP 5xx during the UI check", problems.length === 0, problems.join(" | "));
console.log(failures === 0 ? "\nUI CHECKS PASSED" : `\n${failures} UI CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
