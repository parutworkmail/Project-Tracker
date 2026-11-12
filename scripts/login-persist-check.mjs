// Reproduces: type into /login, leave via a client-side link, come back.
//   node scripts/login-persist-check.mjs http://localhost:3000
// Machine-specific: hardcoded puppeteer cache path and Chrome location, like the other helpers.
import { createRequire } from "node:module";

const require = createRequire(
  "C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/"
);
const puppeteer = require("puppeteer-core");
const base = process.argv[2];

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

const read = (page) =>
  page.evaluate(() => ({
    user: document.querySelector("#login-username")?.value ?? null,
    pass: document.querySelector("#login-password")?.value ?? null,
    passType: document.querySelector("#login-password")?.type ?? null,
    error: document.querySelector("form [role=alert]")?.textContent ?? null,
  }));

let failed = false;
const check = (name, state) => {
  const empty = state.user === "" && state.pass === "" && state.passType === "password" && !state.error;
  if (!empty) failed = true;
  console.log(empty ? "PASS" : "FAIL", name, JSON.stringify(state));
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
  await page.goto(base + "/login", { waitUntil: "networkidle0" });

  // 1: leave through a client-side link (logo), come back through the browser Back button.
  await page.type("#login-username", "someone");
  await page.type("#login-password", "secret-pass");
  await page.click('button[aria-label*="assword"], button[aria-label*="how"]').catch(() => {});
  await page.click('header a[href="/"]');
  await page.waitForFunction(() => location.pathname === "/");
  await page.goBack();
  await page.waitForSelector("#login-username");
  await new Promise((r) => setTimeout(r, 600));
  check("client link away, browser Back", await read(page));

  // 2: leave through a client-side link and return through a client-side link.
  await page.type("#login-username", "again");
  await page.type("#login-password", "again-pass");
  await page.click('header a[href="/"]');
  await page.waitForFunction(() => location.pathname === "/");
  await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/login");
    a.click();
  });
  await page.waitForFunction(() => location.pathname === "/login");
  await page.waitForSelector("#login-username");
  await new Promise((r) => setTimeout(r, 600));
  check("client link away, client link back", await read(page));

  // 3: validation errors from submitting an empty form must not survive leaving.
  await page.goto(base + "/login", { waitUntil: "networkidle0" });
  await page.click("button[type=submit]");
  await page.waitForSelector("form [role=alert]");
  const shown = await read(page);
  console.log(shown.error ? "PASS" : "FAIL", "validation error is shown at first", JSON.stringify(shown));
  await page.click('header a[href="/"]');
  await page.waitForFunction(() => location.pathname === "/");
  await page.goBack();
  await page.waitForSelector("#login-username");
  await new Promise((r) => setTimeout(r, 600));
  check("validation errors gone after leaving", await read(page));

  // 3b: text typed on a page opened with a ?message= (URL based) is still cleared.
  await page.goto(base + "/login?message=Please%20log%20in%20again", { waitUntil: "networkidle0" });
  await page.type("#login-username", "nobody");
  await page.click('header a[href="/"]');
  await page.waitForFunction(() => location.pathname === "/");
  await page.goBack();
  await page.waitForSelector("#login-username");
  await new Promise((r) => setTimeout(r, 600));
  const back = await read(page);
  const clean = back.user === "" && back.pass === "";
  if (!clean) failed = true;
  console.log(clean ? "PASS" : "FAIL", "typed text gone on a ?message= page", JSON.stringify(back));

  // 4: typing still works normally after all of that.
  await page.type("#login-username", "works");
  const typed = await read(page);
  const typingOk = typed.user === "works";
  if (!typingOk) failed = true;
  console.log(typingOk ? "PASS" : "FAIL", "can still type afterwards", JSON.stringify(typed));
} finally {
  await browser.close();
}

process.exit(failed ? 1 : 0);
