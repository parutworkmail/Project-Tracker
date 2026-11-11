// Screenshot helper (uses a cached puppeteer + system Chrome). Usage:
//   node scripts/screenshot.mjs <baseUrl> <outDir> [cookieHeader]
import { createRequire } from "module";

const require = createRequire(
  "C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/"
);
const puppeteer = require("puppeteer-core");

const [base, outDir, cookieHeader] = process.argv.slice(2);
const pages = (process.env.SHOT_PAGES ?? "/,/login").split(",");

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 760 });
  await page.emulateMediaFeatures([
    { name: "prefers-color-scheme", value: theme },
  ]);
  if (cookieHeader) {
    const host = new URL(base).hostname;
    for (const pair of cookieHeader.split("; ")) {
      const i = pair.indexOf("=");
      await page.setCookie({ name: pair.slice(0, i), value: pair.slice(i + 1), domain: host, path: "/" });
    }
  }
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle0", timeout: 45000 });
    const name = (path === "/" ? "home" : path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")) + "-" + theme;
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log("shot", name, "dark class:", await page.evaluate(() => document.documentElement.classList.contains("dark")));
  }
  await page.close();
}
await browser.close();
