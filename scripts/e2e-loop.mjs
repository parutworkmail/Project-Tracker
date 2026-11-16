// End-to-end loop against a running `next start` and the throwaway local database.
// Creates temp users for all 3 roles plus projects, exercises the app end to end, and writes
// docs/test-data/manifest.json listing EVERYTHING it created so it can be removed later with
//   node scripts/with-local-db.mjs node scripts/test-data-cleanup.mjs [--yes]
// Data is kept after the run on purpose (so it can be inspected in the browser).
//
//   node scripts/with-local-db.mjs node scripts/e2e-loop.mjs http://localhost:3100
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const base = process.argv[2] ?? "http://localhost:3100";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestDir = path.join(root, "docs", "test-data");
const manifestPath = path.join(manifestDir, "manifest.json");
const suffix = Math.random().toString(36).slice(2, 7);
const startedAt = new Date();

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: process.env.SUPABASE_DB_SSL === "disable" ? false : { rejectUnauthorized: false },
});

const manifest = {
  note: "Temporary test data created by scripts/e2e-loop.mjs. Remove with scripts/test-data-cleanup.mjs.",
  createdAt: startedAt.toISOString(),
  database: `${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`,
  users: [],
  projects: [],
};

function save() {
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// Every request comes from one IP, so the per-IP login limit (10 per 15 min) would trip the loop.
// It is cleared before each login except inside the dedicated rate-limit check below.
let autoClearLoginLimit = true;

let failures = 0;
let passes = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
  if (ok) passes++;
  else failures++;
}
const brief = (v) => JSON.stringify(v)?.slice(0, 200);

class Session {
  jar = new Map();
  absorb(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      this.jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }
  cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async fetch(p, init = {}) {
    const res = await fetch(base + p, {
      redirect: "manual",
      ...init,
      headers: { ...(init.headers ?? {}), cookie: this.cookie() },
    });
    this.absorb(res);
    return res;
  }
  async json(p, method, body) {
    const res = await this.fetch(p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: res.status, data };
  }
  async login(username, pw) {
    this.jar.clear();
    if (autoClearLoginLimit) await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
    const csrfRes = await this.fetch("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    await this.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, username, password: pw, callbackUrl: base }),
    });
    const session = await (await this.fetch("/api/auth/session")).json();
    return session?.user?.username === username;
  }
  async page(p) {
    const res = await this.fetch(p);
    const html = await res.text();
    return { status: res.status, html, location: res.headers.get("location") ?? "" };
  }
}

const redirectsTo = (r, part) =>
  (r.status >= 300 && r.status < 400 && r.location.includes(part)) ||
  (r.status === 200 && r.html.includes(part) && /NEXT_REDIRECT|redirect/i.test(r.html));

function addUser(u) {
  manifest.users.push(u);
  save();
}

async function main() {
  await client.connect();
  await client.query(`DELETE FROM "RateLimitEntry"`);

  const seedPassword = "Seed-Passw0rd!";
  const finalPassword = "Final-Passw0rd!";
  const names = {
    sa: `e2e_loop_superadmin_${suffix}`,
    admin: `e2e_loop_admin_${suffix}`,
    user1: `e2e_loop_user1_${suffix}`,
    user2: `e2e_loop_user2_${suffix}`,
  };
  const ids = {};

  // Bootstrap super admin straight into the DB (there is no public sign-up).
  ids.sa = `e2e${Math.random().toString(36).slice(2, 12)}`;
  const hash = await bcrypt.hash(seedPassword, 10);
  await client.query(
    `INSERT INTO "User" (id, username, password, role, "mustChangePassword", "updatedAt")
     VALUES ($1, $2, $3, 'SUPER_ADMIN'::"GlobalRole", false, now())`,
    [ids.sa, names.sa, hash]
  );
  addUser({ id: ids.sa, username: names.sa, role: "SUPER_ADMIN", password: seedPassword, via: "db-seed" });

  const sa = new Session();
  const admin = new Session();
  const user1 = new Session();
  const user2 = new Session();

  check("super admin can log in", await sa.login(names.sa, seedPassword));

  // ---- users, one per role ----
  for (const [key, role] of [["admin", "ADMIN"], ["user1", "USER"], ["user2", "USER"]]) {
    const r = await sa.json("/api/admin/users", "POST", {
      username: names[key],
      name: `E2E ${key}`,
      email: `${names[key]}@example.test`,
      password: seedPassword,
      role,
    });
    check(`super admin creates ${role} (${key})`, r.status === 201 && r.data?.role === role, brief(r));
    if (r.status === 201) {
      ids[key] = r.data.id;
      addUser({ id: r.data.id, username: names[key], role, password: seedPassword, via: "admin-api" });
    }
  }

  const dupUser = await sa.json("/api/admin/users", "POST", { username: names.admin, password: seedPassword, role: "USER" });
  check("duplicate username -> 409", dupUser.status === 409, brief(dupUser));

  const shortPw = await sa.json("/api/admin/users", "POST", { username: `e2e_loop_short_${suffix}`, password: "short", role: "USER" });
  check("weak password rejected -> 400", shortPw.status === 400, brief(shortPw));

  const userBlocked = new Session();
  await userBlocked.login(names.user2, seedPassword);
  const userCreates = await userBlocked.json("/api/admin/users", "POST", { username: `e2e_loop_nope_${suffix}`, password: seedPassword, role: "USER" });
  check("plain user cannot create users -> 403", userCreates.status === 403, brief(userCreates));

  // ---- forced password change ----
  for (const [key, session] of [["admin", admin], ["user1", user1], ["user2", user2]]) {
    check(`${key} can log in with temp password`, await session.login(names[key], seedPassword));
    const forced = await session.page("/dashboard");
    check(`${key} is forced to /change-password`, redirectsTo(forced, "/change-password"), `status ${forced.status} loc ${forced.location}`);

    const mismatch = await session.json("/api/account/password", "PATCH", { newPassword: "short" });
    check(`${key} weak new password -> 400`, mismatch.status === 400, brief(mismatch));

    const changed = await session.json("/api/account/password", "PATCH", { newPassword: finalPassword });
    check(`${key} changes password`, changed.status === 200, brief(changed));
    const m = manifest.users.find((u) => u.username === names[key]);
    if (m) {
      m.password = finalPassword;
      save();
    }
    check(`${key} logs in again with new password`, await session.login(names[key], finalPassword));
    const dash = await session.page("/dashboard");
    check(`${key} reaches dashboard after change`, dash.status === 200, `status ${dash.status} loc ${dash.location}`);
    const old = new Session();
    check(`${key} old password rejected`, (await old.login(names[key], seedPassword)) === false);
  }

  // ---- projects ----
  const created = await sa.json("/api/projects/create", "POST", {
    name: `E2E Loop ${suffix}`,
    memberIds: [ids.user1],
  });
  check("super admin creates project", created.status === 201 && !!created.data?.slug, brief(created));
  const slug = created.data?.slug;

  async function trackProject(s, label) {
    const row = (await client.query(`SELECT id, name, "schemaName" FROM "Project" WHERE slug = $1`, [s])).rows[0];
    if (row) {
      manifest.projects.push({ id: row.id, slug: s, name: row.name, schemaName: row.schemaName, purpose: label });
      save();
    }
  }
  await trackProject(slug, "main loop project (kept for browser checks)");

  const api = `/api/projects/${slug}`;

  const adminBefore = await admin.json(`${api}/issues`, "GET");
  check("unassigned ADMIN cannot see the project -> 403", adminBefore.status === 403, brief(adminBefore));

  const assignUser = await sa.json(`/api/admin/projects/${slug}/admins`, "POST", { userId: ids.user1 });
  check("cannot assign a USER-role account as project admin -> 400", assignUser.status === 400, brief(assignUser));

  const assignSa = await sa.json(`/api/admin/projects/${slug}/admins`, "POST", { userId: ids.sa });
  check("cannot assign a SUPER_ADMIN as project admin -> 400", assignSa.status === 400, brief(assignSa));

  const assign = await sa.json(`/api/admin/projects/${slug}/admins`, "POST", { userId: ids.admin });
  check("super admin assigns ADMIN to project", assign.status === 201, brief(assign));

  const adminAfter = await admin.json(`${api}/issues`, "GET");
  check("assigned ADMIN can now see the project", adminAfter.status === 200, brief(adminAfter));

  const user2Before = await user2.json(`${api}/issues`, "GET");
  check("non-member USER cannot see the project -> 403", user2Before.status === 403, brief(user2Before));

  const userAssignAttempt = await user1.json(`/api/admin/projects/${slug}/admins`, "POST", { userId: ids.admin });
  check("plain user cannot assign admins -> 403", userAssignAttempt.status === 403, brief(userAssignAttempt));

  const joined = await user2.json(`${api}/join`, "POST");
  check("user2 joins via link", joined.status === 200, brief(joined));
  const user2After = await user2.json(`${api}/issues`, "GET");
  check("user2 can see the project after joining", user2After.status === 200, brief(user2After));

  const addMember = await admin.json(`${api}/members`, "POST", { username: names.user1 });
  check("adding an existing member -> 409", addMember.status === 409, brief(addMember));

  // ---- labels ----
  const lBug = await sa.json(`${api}/labels`, "POST", { name: "bug", color: "red" });
  const lFeat = await admin.json(`${api}/labels`, "POST", { name: "feature", color: "blue" });
  check("labels created", lBug.status === 201 && lFeat.status === 201, brief([lBug, lFeat]));
  const lDup = await sa.json(`${api}/labels`, "POST", { name: "bug" });
  check("duplicate label -> 409", lDup.status === 409, brief(lDup));
  const lBad = await sa.json(`${api}/labels`, "POST", { name: "   ", color: "red" });
  check("blank label -> 400", lBad.status === 400, brief(lBad));
  const lBadColor = await sa.json(`${api}/labels`, "POST", { name: "x", color: "magenta" });
  check("unknown label colour -> 400", lBadColor.status === 400, brief(lBadColor));
  const labels = await user1.json(`${api}/labels`, "GET");
  check("member lists 2 labels", labels.status === 200 && labels.data?.length === 2, brief(labels));

  // ---- issues ----
  const t1 = await sa.json(`${api}/issues`, "POST", {
    title: "Login page bug",
    description: "Crashes on 100% zoom",
    priority: "urgent",
    dueDate: "2020-01-01",
    assigneeId: ids.user1,
    labelIds: [lBug.data?.id],
  });
  check("create task with labels/assignee/due date", t1.status === 201 && t1.data?.priority === "urgent", brief(t1));
  const t2 = await user1.json(`${api}/issues`, "POST", { title: "Write docs", priority: "low", labelIds: [lFeat.data?.id] });
  check("member creates task", t2.status === 201, brief(t2));
  const t3 = await admin.json(`${api}/issues`, "POST", { title: "Plan release", assigneeId: ids.admin, dueDate: "2099-12-31" });
  check("project admin creates task", t3.status === 201, brief(t3));
  const t4 = await user2.json(`${api}/issues`, "POST", { title: "Unassigned chore" });
  check("joined user creates task", t4.status === 201, brief(t4));

  const badDue = await sa.json(`${api}/issues`, "POST", { title: "x", dueDate: "2027-02-30" });
  check("impossible due date -> 400", badDue.status === 400 && typeof badDue.data?.error === "string", brief(badDue));
  const badAssignee = await sa.json(`${api}/issues`, "POST", { title: "x", assigneeId: "nobody" });
  check("assignee outside project -> 400", badAssignee.status === 400, brief(badAssignee));
  const longTitle = await sa.json(`${api}/issues`, "POST", { title: "x".repeat(201) });
  check("title over 200 chars -> 400", longTitle.status === 400, brief(longTitle));
  const noTitle = await sa.json(`${api}/issues`, "POST", { title: "   " });
  check("blank title -> 400", noTitle.status === 400, brief(noTitle));

  const upd = await user1.json(`${api}/issues/${t2.data?.id}`, "PATCH", { status: "in_progress", title: "Write docs v2", assigneeId: ids.user1 });
  check("member updates status/title/assignee", upd.status === 200 && upd.data?.status === "in_progress", brief(upd));
  const done = await admin.json(`${api}/issues/${t3.data?.id}`, "PATCH", { status: "done" });
  check("admin marks task done", done.status === 200 && done.data?.status === "done", brief(done));
  const relabel = await sa.json(`${api}/issues/${t1.data?.id}`, "PATCH", { labelIds: [lBug.data?.id, lFeat.data?.id] });
  check("labels can be changed on a task", relabel.status === 200, brief(relabel));
  const emptyPatch = await sa.json(`${api}/issues/${t1.data?.id}`, "PATCH", {});
  check("empty update -> 400", emptyPatch.status === 400, brief(emptyPatch));
  const badStatus = await sa.json(`${api}/issues/${t1.data?.id}`, "PATCH", { status: "wat" });
  check("unknown status -> 400", badStatus.status === 400, brief(badStatus));
  const outsiderPatch = await new Session().json(`${api}/issues/${t1.data?.id}`, "PATCH", { status: "done" });
  check("anonymous cannot update -> 401", outsiderPatch.status === 401, brief(outsiderPatch));

  // ---- comments ----
  const c1 = await user1.json(`${api}/issues/${t1.data?.id}/comments`, "POST", { body: "  Can reproduce  " });
  check("member comments (trimmed)", c1.status === 201 && c1.data?.body === "Can reproduce", brief(c1));
  const c2 = await sa.json(`${api}/issues/${t1.data?.id}/comments`, "POST", { body: "Fixing now" });
  check("super admin comments", c2.status === 201, brief(c2));
  const c3 = await admin.json(`${api}/issues/${t1.data?.id}/comments`, "POST", { body: "Admin note" });
  check("project admin comments", c3.status === 201, brief(c3));
  const blankC = await sa.json(`${api}/issues/${t1.data?.id}/comments`, "POST", { body: "   " });
  check("blank comment -> 400", blankC.status === 400, brief(blankC));
  const longC = await sa.json(`${api}/issues/${t1.data?.id}/comments`, "POST", { body: "y".repeat(2001) });
  check("comment over 2000 chars -> 400", longC.status === 400, brief(longC));
  const delOthers = await user1.json(`${api}/issues/${t1.data?.id}/comments/${c2.data?.id}`, "DELETE");
  check("member cannot delete another's comment -> 403", delOthers.status === 403, brief(delOthers));
  const delOwn = await user1.json(`${api}/issues/${t1.data?.id}/comments/${c1.data?.id}`, "DELETE");
  check("author deletes own comment", delOwn.status === 200, brief(delOwn));
  const delByAdmin = await admin.json(`${api}/issues/${t1.data?.id}/comments/${c2.data?.id}`, "DELETE");
  check("project admin deletes someone else's comment", delByAdmin.status === 200, brief(delByAdmin));
  const cList = await sa.json(`${api}/issues/${t1.data?.id}/comments`, "GET");
  check("1 comment left", cList.status === 200 && cList.data?.length === 1, brief(cList));

  // ---- pages: list, filters, board view ----
  const list = await sa.page(`/${slug}/board`);
  check("task list renders all tasks", list.status === 200 && ["Login page bug", "Write docs v2", "Plan release", "Unassigned chore"].every((t) => list.html.includes(t)), `status ${list.status}`);
  const kanban = await sa.page(`/${slug}/board?view=board`);
  check("kanban view renders", kanban.status === 200 && kanban.html.includes("Login page bug"), `status ${kanban.status}`);
  const fq = await sa.page(`/${slug}/board?q=docs`);
  check("search filter", fq.html.includes("Write docs v2") && !fq.html.includes("Login page bug"));
  const fPct = await sa.page(`/${slug}/board?q=100%25`);
  check("search treats % literally", fPct.html.includes("Login page bug") && !fPct.html.includes("Write docs v2"));
  const fStatus = await sa.page(`/${slug}/board?status=done`);
  check("status filter", fStatus.html.includes("Plan release") && !fStatus.html.includes("Login page bug"));
  const fPrio = await sa.page(`/${slug}/board?priority=urgent`);
  check("priority filter", fPrio.html.includes("Login page bug") && !fPrio.html.includes("Write docs v2"));
  const fAssignee = await sa.page(`/${slug}/board?assignee=unassigned`);
  check("unassigned filter", fAssignee.html.includes("Unassigned chore") && !fAssignee.html.includes("Plan release"));
  const fLabel = await sa.page(`/${slug}/board?label=${lFeat.data?.id}`);
  check("label filter", fLabel.html.includes("Login page bug") && fLabel.html.includes("Write docs v2") && !fLabel.html.includes("Plan release"), `status ${fLabel.status}`);
  const fSort = await sa.page(`/${slug}/board?sort=due`);
  check("sort by due date renders", fSort.status === 200);
  const fEmpty = await sa.page(`/${slug}/board?q=zzzzqqq`);
  check("empty filter state message", fEmpty.html.includes("No tasks match your filters."));
  const fFar = await sa.page(`/${slug}/board?page=9`);
  check("page beyond range does not crash", [200, 307, 308].includes(fFar.status), `status ${fFar.status}`);
  const fWeird = await sa.page(`/${slug}/board?sort=constructor&status=%27%3B--&page=abc&label=%27`);
  check("hostile query params do not crash", fWeird.status === 200, `status ${fWeird.status}`);

  const detail = await user1.page(`/${slug}/board/${t1.data?.id}`);
  check("task detail renders with comment", detail.status === 200 && detail.html.includes("Login page bug") && detail.html.includes("Admin note"), `status ${detail.status}`);
  const missing = await user1.page(`/${slug}/board/does-not-exist`);
  check("unknown task shows not-found", (missing.status === 404 || /could not be found|not-found|NEXT_HTTP_ERROR_FALLBACK;404/i.test(missing.html)) && !missing.html.includes("Login page bug"), `status ${missing.status}`);
  const anon = await new Session().page(`/${slug}/board/${t1.data?.id}`);
  check("anonymous detail goes to login and leaks nothing", redirectsTo(anon, "/login") && !anon.html.includes("Login page bug"), `status ${anon.status}`);
  const outsiderPage = await (async () => {
    const s = new Session();
    await s.login(names.user2, finalPassword);
    await user2.json(`/api/projects/${slug}/members/${ids.user2}`, "DELETE"); // leave first so the page is truly off-limits
    return s.page(`/${slug}/board`);
  })();
  check("former member sees no tasks on the board page", !outsiderPage.html.includes("Login page bug"), `status ${outsiderPage.status}`);

  // ---- CSV export ----
  const csv = await sa.fetch(`${api}/issues/export`);
  const csvText = await csv.text();
  check("CSV export returns file with header + rows", csv.status === 200 && (csv.headers.get("content-type") ?? "").includes("text/csv") && csvText.split("\n")[0].includes("Title") && csvText.includes("Login page bug"), `status ${csv.status} first ${csvText.split("\n")[0]}`);
  check("CSV export marks truncation header", csv.headers.get("x-export-truncated") === "false");
  const csvFiltered = await sa.fetch(`${api}/issues/export?status=done`);
  const csvFilteredText = await csvFiltered.text();
  check("CSV export honours filters", csvFiltered.status === 200 && csvFilteredText.includes("Plan release") && !csvFilteredText.includes("Login page bug"));
  const csvDenied = await new Session().fetch(`${api}/issues/export`);
  check("CSV export needs login", csvDenied.status === 401, `status ${csvDenied.status}`);
  const csvOutsider = await user2.fetch(`${api}/issues/export`);
  check("CSV export needs membership", csvOutsider.status === 403, `status ${csvOutsider.status}`);
  const csvInjection = await sa.json(`${api}/issues`, "POST", { title: "=HYPERLINK(\"http://evil\")" });
  const csvInj = await sa.fetch(`${api}/issues/export`);
  const csvInjText = await csvInj.text();
  check("CSV neutralises formula injection", csvInjection.status === 201 && !/(^|,|\n)=HYPERLINK/.test(csvInjText), "formula not escaped");

  // ---- other pages ----
  const dash = await sa.page("/dashboard");
  check("dashboard renders for super admin", dash.status === 200 && dash.html.includes(`E2E Loop ${suffix}`), `status ${dash.status}`);
  const dashUser = await user1.page("/dashboard");
  check("dashboard lists project for member", dashUser.status === 200 && dashUser.html.includes(`E2E Loop ${suffix}`), `status ${dashUser.status}`);
  const myAll = await user1.page("/my-tasks");
  check("global my-tasks shows assigned open task", myAll.status === 200 && myAll.html.includes("Login page bug"), `status ${myAll.status}`);
  const myProj = await user1.page(`/${slug}/my-tasks`);
  check("project my-tasks shows assigned open task", myProj.status === 200 && myProj.html.includes("Login page bug"), `status ${myProj.status}`);
  const myAdminDone = await admin.page("/my-tasks");
  check("my-tasks hides done tasks", myAdminDone.status === 200 && !myAdminDone.html.includes("Plan release"), `status ${myAdminDone.status}`);
  const settings = await sa.page(`/${slug}/settings`);
  check("project settings renders", settings.status === 200, `status ${settings.status}`);
  const settingsUser = await user1.page(`/${slug}/settings`);
  check("plain member does not get manager settings", settingsUser.status !== 200 || !/Delete project/i.test(settingsUser.html), `status ${settingsUser.status}`);
  const adminPage = await sa.page("/admin");
  check("admin console renders", adminPage.status === 200 && adminPage.html.includes(names.admin), `status ${adminPage.status}`);
  const adminDenied = await user1.page("/admin");
  check("plain user cannot open /admin", adminDenied.status !== 200 || !adminDenied.html.includes(names.admin), `status ${adminDenied.status}`);
  const newUserPage = await sa.page("/admin/users/new");
  check("create-user page renders", newUserPage.status === 200, `status ${newUserPage.status}`);
  const projList = await user1.json("/api/projects", "GET");
  check("project list API for member", projList.status === 200 && Array.isArray(projList.data) && projList.data.some((p) => p.slug === slug), brief(projList));
  const adminProjects = await sa.json("/api/admin/projects", "GET");
  check("admin projects API", adminProjects.status === 200, brief(adminProjects));
  const adminProjectsDenied = await user1.json("/api/admin/projects", "GET");
  check("admin projects API denies plain user", adminProjectsDenied.status === 403, brief(adminProjectsDenied));
  const footer = await sa.page("/dashboard");
  check("footer shows version", /v\d+\.\d+\.\d+/.test(footer.html), "no version in footer");

  // ---- members: leave / remove ----
  const rejoin = await user2.json(`${api}/join`, "POST");
  check("user2 rejoins", rejoin.status === 200, brief(rejoin));
  const strangerRemoves = await user2.json(`${api}/members/${ids.user1}`, "DELETE");
  check("plain member cannot remove another member -> 403", strangerRemoves.status === 403, brief(strangerRemoves));
  const removeByAdmin = await admin.json(`${api}/members/${ids.user2}`, "DELETE");
  check("project admin removes a member", removeByAdmin.status === 200, brief(removeByAdmin));
  const leaveAgain = await user2.json(`${api}/members/${ids.user2}`, "DELETE");
  check("removed user leaving again -> 404/403", [403, 404].includes(leaveAgain.status), brief(leaveAgain));
  const leave = await user1.json(`${api}/members/${ids.user1}`, "DELETE");
  check("member can leave the project", leave.status === 200, brief(leave));
  const afterLeave = await user1.json(`${api}/issues`, "GET");
  check("leaver loses access", afterLeave.status === 403, brief(afterLeave));
  const unassigned = await sa.page(`/${slug}/board?assignee=unassigned`);
  check("leaver's tasks became unassigned", unassigned.html.includes("Login page bug"));
  const readd = await sa.json(`${api}/members`, "POST", { username: ` ${names.user1} ` });
  check("manager re-adds member by username (trimmed)", readd.status === 201, brief(readd));

  // ---- admin user management ----
  const edit = await sa.json(`/api/admin/users/${ids.user1}`, "PATCH", { name: "Renamed", email: `${names.user1}@example.test` });
  check("admin edits name/email", edit.status === 200 && edit.data?.name === "Renamed", brief(edit));
  const clash = await sa.json(`/api/admin/users/${ids.user1}`, "PATCH", { username: names.admin });
  check("rename onto existing username -> 409", clash.status === 409, brief(clash));
  const selfRole = await sa.json(`/api/admin/users/${ids.sa}`, "PATCH", { role: "USER" });
  check("cannot change own role -> 400", selfRole.status === 400, brief(selfRole));
  const roleChange = await sa.json(`/api/admin/users/${ids.user2}`, "PATCH", { role: "ADMIN" });
  check("admin changes another user's role", roleChange.status === 200 && roleChange.data?.role === "ADMIN", brief(roleChange));
  const roleBack = await sa.json(`/api/admin/users/${ids.user2}`, "PATCH", { role: "USER" });
  check("role changed back", roleBack.status === 200 && roleBack.data?.role === "USER", brief(roleBack));
  const nonAdminEdit = await user1.json(`/api/admin/users/${ids.sa}`, "PATCH", { name: "x" });
  check("non-admin cannot edit users -> 403", nonAdminEdit.status === 403, brief(nonAdminEdit));
  const reset = await sa.json(`/api/admin/users/${ids.user2}/reset-password`, "POST", { password: "Reset-Passw0rd!" });
  check("admin resets a password", reset.status === 200, brief(reset));
  const m2 = manifest.users.find((u) => u.username === names.user2);
  if (m2) {
    m2.password = "Reset-Passw0rd! (must change on next login)";
    save();
  }
  const selfReset = await sa.json(`/api/admin/users/${ids.sa}/reset-password`, "POST", { password: "Reset-Passw0rd!" });
  check("cannot reset own password via admin route -> 400", selfReset.status === 400, brief(selfReset));
  const afterReset = new Session();
  check("reset password works for the user", await afterReset.login(names.user2, "Reset-Passw0rd!"));
  const forcedAgain = await afterReset.page("/dashboard");
  check("reset user is forced to change password again", redirectsTo(forcedAgain, "/change-password"), `status ${forcedAgain.status}`);

  // ---- lockout (own throwaway account so the rest of the data stays usable) ----
  const lockName = `e2e_loop_lock_${suffix}`;
  const lockUser = await sa.json("/api/admin/users", "POST", { username: lockName, password: seedPassword, role: "USER" });
  if (lockUser.status === 201) addUser({ id: lockUser.data.id, username: lockName, role: "USER", password: seedPassword, via: "admin-api", purpose: "lockout test" });
  await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
  const badTries = new Session();
  for (let i = 0; i < 5; i++) await badTries.login(lockName, `wrong-${i}`);
  check("account locks after 5 bad logins", (await new Session().login(lockName, seedPassword)) === false);
  await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);

  // ---- per-IP login rate limit ----
  autoClearLoginLimit = false;
  await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
  const flood = new Session();
  for (let i = 0; i < 11; i++) await flood.login(`e2e_loop_nobody_${suffix}`, "wrong");
  const limitedLogin = await new Session().login(names.sa, seedPassword);
  check("login is refused after too many attempts from one IP", limitedLogin === false);
  const limitedRows = await client.query(`SELECT 1 FROM "AuditLog" WHERE action = 'login.rate_limited' AND "createdAt" >= $1`, [startedAt.toISOString()]);
  check("rate-limited logins are audited", limitedRows.rowCount > 0);
  autoClearLoginLimit = true;
  await client.query(`DELETE FROM "RateLimitEntry" WHERE key LIKE 'login:%'`);
  check("login works again once the window is cleared", await new Session().login(names.sa, seedPassword));

  // ---- delete flows on a second project ----
  const created2 = await sa.json("/api/projects/create", "POST", { name: `E2E Delete ${suffix}` });
  check("second project created", created2.status === 201, brief(created2));
  const slug2 = created2.data?.slug;
  await trackProject(slug2, "project used to test deletion (should be gone after the run)");
  const t2a = await sa.json(`/api/projects/${slug2}/issues`, "POST", { title: "Delete me" });
  const delIssueMember = await user1.json(`/api/projects/${slug2}/issues/${t2a.data?.id}`, "DELETE");
  check("non-member cannot delete tasks", [401, 403].includes(delIssueMember.status), brief(delIssueMember));
  const delIssue = await sa.json(`/api/projects/${slug2}/issues/${t2a.data?.id}`, "DELETE");
  check("manager deletes a task", delIssue.status === 200, brief(delIssue));
  const delIssueAgain = await sa.json(`/api/projects/${slug2}/issues/${t2a.data?.id}`, "DELETE");
  check("deleting a task twice is harmless (idempotent 200)", delIssueAgain.status === 200, brief(delIssueAgain));

  const projName2 = `E2E Delete ${suffix}`;
  const delProjUser = await user1.json(`/api/admin/projects/${slug2}`, "DELETE", { confirmName: projName2 });
  check("plain user cannot delete project -> 403", delProjUser.status === 403, brief(delProjUser));
  const delNoName = await sa.json(`/api/admin/projects/${slug2}`, "DELETE", { confirmName: "" });
  check("project delete without typed name -> 400", delNoName.status === 400, brief(delNoName));
  const delWrongName = await sa.json(`/api/admin/projects/${slug2}`, "DELETE", { confirmName: "something else" });
  check("project delete with wrong typed name -> 400", delWrongName.status === 400, brief(delWrongName));
  const stillThere = await sa.json(`/api/projects/${slug2}/issues`, "GET");
  check("project survives wrong-name delete attempts", stillThere.status === 200, brief(stillThere));
  const delProj = await sa.json(`/api/admin/projects/${slug2}`, "DELETE", { confirmName: projName2 });
  check("super admin deletes project", delProj.status === 200, brief(delProj));
  const gone = await client.query(`SELECT 1 FROM "Project" WHERE slug = $1`, [slug2]);
  check("deleted project row is gone", gone.rowCount === 0);
  const schemaLeft = await client.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    [manifest.projects.find((p) => p.slug === slug2)?.schemaName]
  );
  check("deleted project schema is dropped", schemaLeft.rowCount === 0);
  const goneApi = await sa.json(`/api/projects/${slug2}/issues`, "GET");
  check("deleted project -> 404", goneApi.status === 404, brief(goneApi));
  if (gone.rowCount === 0) {
    manifest.projects = manifest.projects.filter((p) => p.slug !== slug2);
    save();
  }

  const delLabel = await sa.json(`${api}/labels/${lFeat.data?.id}`, "DELETE");
  check("label can be deleted", delLabel.status === 200, brief(delLabel));
  const afterLabel = await sa.page(`/${slug}/board/${t2.data?.id}`);
  check("task still renders after its label was deleted", afterLabel.status === 200, `status ${afterLabel.status}`);

  const unassignAdmin = await sa.json(`/api/admin/projects/${slug}/admins/${ids.admin}`, "DELETE");
  check("super admin removes project admin", unassignAdmin.status === 200, brief(unassignAdmin));
  const adminGone = await admin.json(`${api}/issues`, "GET");
  check("removed ADMIN loses project access", adminGone.status === 403, brief(adminGone));
  const reassign = await sa.json(`/api/admin/projects/${slug}/admins`, "POST", { userId: ids.admin });
  check("project admin re-assigned (kept for browser checks)", reassign.status === 201, brief(reassign));

  // ---- admin logs ----
  const logs = await sa.page("/admin/logs");
  check("/admin/logs renders for super admin", logs.status === 200, `status ${logs.status}`);
  const logsDenied = await user1.page("/admin/logs");
  check("/admin/logs hidden from plain user", logsDenied.status !== 200 || !/user\.created|login\.success/.test(logsDenied.html), `status ${logsDenied.status}`);
  const logsAdminDenied = await admin.page("/admin/logs");
  check("/admin/logs hidden from project ADMIN", logsAdminDenied.status !== 200 || !/user\.created|login\.success/.test(logsAdminDenied.html), `status ${logsAdminDenied.status}`);

  // ---- audit rows ----
  const since = startedAt.toISOString();
  const rows = await client.query(
    `SELECT action, level, count(*)::int AS n FROM "AuditLog" WHERE "createdAt" >= $1 GROUP BY action, level`,
    [since]
  );
  const seen = new Map(rows.rows.map((r) => [r.action, r]));
  for (const action of [
    "login.success", "login.failed", "login.locked", "user.created", "user.updated", "user.role_changed",
    "user.password_reset", "password.changed", "project.created", "project.deleted",
    "project.admin_assigned", "project.admin_removed", "project.member_joined",
  ]) {
    check(`audit row written: ${action}`, seen.has(action), "missing");
  }
  const failedLevel = seen.get("login.failed");
  check("failed logins are recorded as WARN", !failedLevel || failedLevel.level === "WARN", brief(failedLevel));
  const leaked = await client.query(
    `SELECT count(*)::int AS n FROM "AuditLog" WHERE "createdAt" >= $1 AND (message ILIKE $2 OR message ILIKE $3 OR meta::text ILIKE $2 OR meta::text ILIKE $3)`,
    [since, `%${seedPassword}%`, `%${finalPassword}%`]
  );
  check("no passwords leaked into audit rows", leaked.rows[0].n === 0, `${leaked.rows[0].n} rows`);
  const unexpected = await client.query(
    `SELECT action, message FROM "AuditLog" WHERE "createdAt" >= $1 AND level = 'ERROR'`,
    [since]
  );
  check("no ERROR audit rows during the run", unexpected.rowCount === 0, brief(unexpected.rows));

  // ---- summary ----
  manifest.finishedAt = new Date().toISOString();
  manifest.result = { passed: passes, failed: failures };
  manifest.logins = Object.fromEntries(manifest.users.map((u) => [u.username, u.password]));
  save();
  console.log(`\nmanifest: ${manifestPath}`);
  console.log(`users created: ${manifest.users.length}, projects kept: ${manifest.projects.length}`);
  console.log(failures === 0 ? `\nALL ${passes} LOOP CHECKS PASSED` : `\n${failures} LOOP CHECK(S) FAILED (${passes} passed)`);
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("E2E loop crashed:", error);
  manifest.crashed = String(error?.message ?? error);
  save();
  try {
    await client.end();
  } catch {}
  process.exit(2);
});
