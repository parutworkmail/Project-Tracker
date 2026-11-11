// Visual pass: seeds demo data in the (local) database, logs in through the real login form,
// and screenshots the authenticated pages in light and dark mode. Cleans up afterwards.
//   node scripts/with-local-db.mjs node scripts/visual-pass.mjs http://localhost:3400 tmp-shots
import { createRequire } from "node:module";
import pg from "pg";
import bcrypt from "bcryptjs";

const require = createRequire(
  "C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/"
);
const puppeteer = require("puppeteer-core");

const [base, outDir] = process.argv.slice(2);
const suffix = Math.random().toString(36).slice(2, 7);
const adminName = `e2e_vis_admin_${suffix}`;
const memberName = `e2e_vis_member_${suffix}`;
const password = "Vis-Passw0rd!";

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: process.env.SUPABASE_DB_SSL === "disable" ? false : { rejectUnauthorized: false, ecdhCurve: "X25519:prime256v1:secp384r1" },
});

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});

let slug = null;

try {
  await client.connect();
  const hash = await bcrypt.hash(password, 10);
  const ids = {};
  for (const [name, role, display] of [
    [adminName, "SUPER_ADMIN", "Visual Admin"],
    [memberName, "USER", "Mia Member"],
  ]) {
    const id = `vis${Math.random().toString(36).slice(2, 12)}`;
    ids[name] = id;
    await client.query(
      `INSERT INTO "User" (id, username, name, password, role, "mustChangePassword", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"GlobalRole", false, now())`,
      [id, name, display, hash, role]
    );
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(base + "/login", { waitUntil: "networkidle0" });
  await page.type("#login-username", adminName);
  await page.type("#login-password", password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
    page.click("button[type=submit]"),
  ]);
  console.log("logged in, now at", new URL(page.url()).pathname);

  const api = (path, method, body) =>
    page.evaluate(
      async (path, method, body) => {
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, data: await res.json().catch(() => null) };
      },
      path,
      method,
      body
    );

  const created = await api("/api/projects/create", "POST", {
    name: "Website Redesign",
    memberIds: [ids[memberName]],
  });
  slug = created.data.slug;
  console.log("project", slug, created.status);

  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const seed = [
    { title: "Fix login redirect loop", priority: "urgent", dueDate: day(-3), assigneeId: ids[memberName], description: "Users get bounced between /login and /dashboard." },
    { title: "Design new dashboard cards", priority: "high", dueDate: day(4), assigneeId: ids[adminName] },
    { title: "Write onboarding documentation for the whole team including screenshots and examples", priority: "medium", dueDate: day(10) },
    { title: "Upgrade dependencies", priority: "low" },
    { title: "Add dark mode toggle", priority: "medium", dueDate: day(1), assigneeId: ids[memberName] },
    { title: "Audit accessibility", priority: "high", assigneeId: ids[adminName] },
  ];
  const issues = [];
  for (const item of seed) {
    const r = await api(`/api/projects/${slug}/issues`, "POST", item);
    issues.push(r.data);
  }
  await api(`/api/projects/${slug}/issues/${issues[4].id}`, "PATCH", { status: "done" });
  await api(`/api/projects/${slug}/issues/${issues[1].id}`, "PATCH", { status: "in_progress" });
  await api(`/api/projects/${slug}/issues/${issues[0].id}/comments`, "POST", { body: "Reproduced on Chrome and Firefox. Looks like the session cookie is read before it is written." });
  await api(`/api/projects/${slug}/issues/${issues[0].id}/comments`, "POST", { body: "Fix is in review." });

  const shots = [
    ["dashboard", "/dashboard"],
    ["board", `/${slug}/board`],
    ["board-filtered", `/${slug}/board?status=in_progress&sort=priority`],
    ["board-empty-filter", `/${slug}/board?q=zzzz`],
    ["task", `/${slug}/board/${issues[0].id}`],
    ["settings", `/${slug}/settings`],
    ["admin", "/admin"],
  ];

  for (const theme of ["light", "dark"]) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    for (const [name, path] of shots) {
      await page.goto(base + path, { waitUntil: "networkidle0", timeout: 45000 });
      await page.screenshot({ path: `${outDir}/auth-${name}-${theme}.png`, fullPage: true });
    }
    await page.goto(base + `/${slug}/board`, { waitUntil: "networkidle0" });
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await b.evaluate((el) => el.textContent);
      if (text && text.includes("Create task")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${outDir}/auth-create-dialog-${theme}.png` });
    console.log("shots done:", theme);
  }
} finally {
  await browser.close();
  if (slug) {
    const proj = await client.query(`SELECT id, "schemaName" FROM "Project" WHERE slug = $1`, [slug]);
    for (const row of proj.rows) {
      if (/^proj_[a-f0-9]{32}$/.test(row.schemaName)) await client.query(`DROP SCHEMA IF EXISTS "${row.schemaName}" CASCADE`);
      await client.query(`DELETE FROM "Project" WHERE id = $1`, [row.id]);
    }
  }
  await client.query(`DELETE FROM "User" WHERE username = ANY($1)`, [[adminName, memberName]]);
  await client.end();
  console.log("cleaned up demo data");
}
