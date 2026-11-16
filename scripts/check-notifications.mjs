// Focused check of tags (@mentions) and notifications against the local test database.
// Reuses the users/project listed in docs/test-data/manifest.json (made by e2e-loop.mjs).
//   node scripts/with-local-db.mjs node scripts/check-notifications.mjs http://localhost:3100 [shots-dir]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "docs", "test-data", "manifest.json"), "utf8"));
const base = process.argv[2] ?? "http://localhost:3100";
const shots = path.resolve(root, process.argv[3] ?? "tmp-shots");
fs.mkdirSync(shots, { recursive: true });

const user = (part) => manifest.users.find((u) => u.username.includes(part));
const sa = user("superadmin");
const u1 = user("user1");
const adminUser = user("_admin_");
const u2 = user("user2");
const slug = manifest.projects[0].slug;

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: false,
});

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
  if (!ok) failures++;
};

class Session {
  jar = new Map();
  async fetch(p, init = {}) {
    const res = await fetch(base + p, { redirect: "manual", ...init, headers: { ...(init.headers ?? {}), cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  }
  async json(p, method = "GET", body) {
    const res = await this.fetch(p, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async login(account) {
    await client.query(`DELETE FROM "RateLimitEntry"`);
    const { csrfToken } = await (await this.fetch("/api/auth/csrf")).json();
    await this.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, username: account.username, password: account.password, callbackUrl: base }),
    });
    return (await (await this.fetch("/api/auth/session")).json())?.user?.username === account.username;
  }
  async html(p) {
    const res = await this.fetch(p);
    return { status: res.status, html: await res.text() };
  }
  count(slugArg) {
    return this.json(`/api/notifications/unread-count${slugArg ? `?slug=${slugArg}` : ""}`).then((r) => r.data?.count);
  }
}

await client.connect();
const s = new Session(), a = new Session(), m = new Session();
check("logins", (await s.login(sa)) && (await m.login(u1)) && (await a.login(adminUser)));

const api = `/api/projects/${slug}`;
const before = { u1: await m.count(slug), admin: await a.count(slug) };

const issue = await s.json(`${api}/issues`, "POST", { title: "Notify me", assigneeId: u1.id });
check("task created with assignee", issue.status === 201, JSON.stringify(issue));
const issueId = issue.data?.id;

check("assignee gets 1 notification", (await m.count(slug)) === before.u1 + 1, await m.count(slug));

const own = await s.json(`${api}/issues`, "POST", { title: "Self assigned", assigneeId: sa.id });
check("assigning yourself notifies nobody", own.status === 201 && (await s.count(slug)) === 0);

const comment = await s.json(`${api}/issues/${issueId}/comments`, "POST", {
  body: `please look @${u1.username} and @${adminUser.username}. cc @${sa.username} @${u2.username} @nobody_here`,
});
check("comment with tags posted", comment.status === 201, JSON.stringify(comment));
check("tagged member notified", (await m.count(slug)) === before.u1 + 2, await m.count(slug));
check("tagged project admin notified", (await a.count(slug)) === before.admin + 1, await a.count(slug));
check("tagging yourself notifies nobody", (await s.count(slug)) === 0);
const schema = (await client.query(`SELECT "schemaName" FROM "Project" WHERE slug = $1`, [slug])).rows[0].schemaName;
const outsider = await client.query(`SELECT 1 FROM "${schema}"."notifications" WHERE user_id = $1`, [u2.id]);
check("tagging someone outside the project notifies nobody", outsider.rowCount === 0, `${outsider.rowCount} rows`);

const same = await s.json(`${api}/issues/${issueId}`, "PATCH", { assigneeId: u1.id });
check("re-saving the same assignee does not notify again", same.status === 200 && (await m.count(slug)) === before.u1 + 2);
const moved = await s.json(`${api}/issues/${issueId}`, "PATCH", { assigneeId: adminUser.id });
check("reassigning notifies the new assignee", moved.status === 200 && (await a.count(slug)) === before.admin + 2);

for (let i = 0; i < 10; i++) {
  await s.json(`${api}/issues/${issueId}/comments`, "POST", { body: `ping ${i} @${u1.username}` });
}
const many = await m.count(slug);
check("many unread (11+)", many >= 12, many);
check("global count includes this project", (await m.count()) >= many);

const page = await m.html(`/${slug}/my-tasks`);
check("project My tasks page shows the Notifications section first", page.html.includes("Notifications") && page.html.indexOf("Notifications") < page.html.indexOf(">Tasks<") && page.html.includes("tagged you in a comment on"), `status ${page.status}`);
check("nav shows 9+ for more than 9", page.html.includes("9+"));
const globalPage = await m.html("/my-tasks");
check("global My tasks page shows notifications with the project name", globalPage.html.includes("Notifications") && globalPage.html.includes(manifest.projects[0].name));

const mention = await m.html(`/${slug}/board/${issueId}`);
check("task page highlights tags in comments", mention.html.includes(`@${u1.username}`) && mention.html.includes("bg-accent/30"));

// Screenshots while there is something to see.
const require = createRequire("C:/Users/parut.singhapun/AppData/Local/npm-cache/_npx/668c188756b835f3/node_modules/");
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
try {
  await client.query(`DELETE FROM "RateLimitEntry"`);
  const pageB = await browser.newPage();
  await pageB.setViewport({ width: 1280, height: 900 });
  await pageB.goto(base + "/login", { waitUntil: "networkidle0" });
  await pageB.type("#login-username", u1.username);
  await pageB.type("#login-password", u1.password);
  await Promise.all([pageB.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {}), pageB.click("button[type=submit]")]);
  await pageB.goto(`${base}/${slug}/my-tasks`, { waitUntil: "networkidle0" });
  await pageB.screenshot({ path: path.join(shots, "notifications-project.png") });
  const badgeText = await pageB.$$eval("nav[aria-label='Project menu'] a", (as) => as.map((x) => x.textContent?.replace(/\s+/g, " ").trim()));
  console.log("project menu:", JSON.stringify(badgeText));
  check("project menu badge shows 9+", badgeText.some((t) => t?.includes("My tasks") && t.includes("9+")), JSON.stringify(badgeText));

  await pageB.goto(`${base}/${slug}/board/${issueId}`, { waitUntil: "networkidle0" });
  await pageB.click("#new-comment");
  await pageB.keyboard.type(`hello @${adminUser.username.slice(0, 8)}`);
  await new Promise((r) => setTimeout(r, 400));
  await pageB.screenshot({ path: path.join(shots, "mention-autocomplete.png") });
  const options = await pageB.$$eval("[role=option]", (els) => els.map((e) => e.textContent));
  check("typing @ shows the people list", options.length > 0 && options.some((t) => t?.includes(adminUser.username)), JSON.stringify(options));
  await pageB.keyboard.press("Enter");
  const value = await pageB.$eval("#new-comment", (el) => el.value);
  check("Enter picks the person and inserts the full username", value.includes(`@${adminUser.username} `), value);

  await new Promise((r) => setTimeout(r, 2500));
  const afterOpen = await m.count(slug);
  check("opening the task cleared its notifications and left other tasks' ones alone", afterOpen === before.u1, `${afterOpen} vs baseline ${before.u1}`);
  await pageB.goto(`${base}/${slug}/my-tasks`, { waitUntil: "networkidle0" });
  await pageB.screenshot({ path: path.join(shots, "notifications-read.png") });
  const menuAfter = await pageB.$$eval("nav[aria-label='Project menu'] a", (as) => as.map((x) => x.textContent?.replace(/\s+/g, " ").trim()));
  const myTasksAfter = menuAfter.find((t) => t?.startsWith("My tasks")) ?? "";
  check(
    "badge shows only what is still unread",
    before.u1 === 0 ? !/\d/.test(myTasksAfter) : myTasksAfter.includes(String(before.u1)) && !myTasksAfter.includes("9+"),
    JSON.stringify(menuAfter)
  );
} finally {
  await browser.close();
}

const all = await a.json("/api/notifications/read", "POST", {});
check("mark all as read (all projects)", all.status === 200 && (await a.count()) === 0, JSON.stringify(all));

await client.end();
console.log(failures === 0 ? "\nNOTIFICATION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
