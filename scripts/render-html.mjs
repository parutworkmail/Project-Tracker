// Renders an HTML file to a full-page PNG with headless Chrome/Edge.
//   node scripts/render-html.mjs <input.html> <output.png> [width]
// puppeteer-core is found automatically in the npx cache; if it is missing run
//   npx -y -p puppeteer-core node -e "console.log('cached')"
// once to download it. If the output PNG is locked (open in a viewer), the file is
// written to <name>-v2.png (then -v3 ...) instead of failing.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

function findPuppeteerCore() {
  const roots = [
    path.join(process.env.LOCALAPPDATA ?? "", "npm-cache", "_npx"),
    path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".npm", "_npx"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      const modules = path.join(root, dir, "node_modules");
      if (fs.existsSync(path.join(modules, "puppeteer-core"))) return modules + path.sep;
    }
  }
  throw new Error(
    'puppeteer-core not found. Run: npx -y -p puppeteer-core node -e "console.log(1)" then retry.'
  );
}

function findBrowser() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("No Chrome or Edge found.");
  return found;
}

function freeOutputPath(output) {
  try {
    fs.closeSync(fs.openSync(output, "a"));
    return output;
  } catch {
    const { dir, name, ext } = path.parse(output);
    for (let version = 2; version < 20; version++) {
      const candidate = path.join(dir, `${name.replace(/-v\d+$/, "")}-v${version}${ext}`);
      if (!fs.existsSync(candidate)) return candidate;
    }
    throw new Error("Could not find a free output file name.");
  }
}

const [input, outputArg, widthArg] = process.argv.slice(2);
if (!input || !outputArg) {
  console.error("usage: node scripts/render-html.mjs <input.html> <output.png> [width]");
  process.exit(1);
}

const require = createRequire(findPuppeteerCore());
const puppeteer = require("puppeteer-core");
const width = Number(widthArg) || 1280;
const output = freeOutputPath(outputArg);

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.resolve(input)).href, { waitUntil: "networkidle0" });
  await page.screenshot({ path: output, fullPage: true });
  console.log("rendered", output);
} finally {
  await browser.close();
}
