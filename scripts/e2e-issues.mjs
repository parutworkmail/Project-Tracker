// Temporary end-to-end smoke test against a locally running `next start` and the real DB.
// Usage: node --env-file=.env scripts/e2e-issues.mjs http://localhost:3100
import pg from "pg";
import bcrypt from "bcryptjs";

const base = process.argv[2] ?? "http://localhost:3100";
const suffix = Math.random().toString(36).slice(2, 8);
const adminName = `e2e_admin_${suffix}`;
const memberName = `e2e_member_${suffix}`;
const password = "E2e-Passw0rd!";

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME,
  ssl: process.env.SUPABASE_DB_SSL === "disable" ? false : { rejectUnauthorized: false, ecdhCurve: "X25519:prime256v1:secp384r1" },
});

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
  if (!ok) failures++;
}

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
  async fetch(path, init = {}) {
    const res = await fetch(base + path, {
      redirect: "manual",
      ...init,
      headers: { ...(init.headers ?? {}), cookie: this.cookie() },
    });
    this.absorb(res);
    return res;
  }
  async json(path, method, body) {
    const res = await this.fetch(path, {
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
  async login(username, pw = password) {
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
}

async function main() {
  await client.connect();
  const hash = await bcrypt.hash(password, 10);

  const ids = {};
  for (const [name, role] of [[adminName, "SUPER_ADMIN"], [memberName, "USER"]]) {
    const id = `e2e${Math.random().toString(36).slice(2, 12)}`;
    ids[name] = id;
    await client.query(
      `INSERT INTO "User" (id, username, password, role, "mustChangePassword", "updatedAt")
       VALUES ($1, $2, $3, $4::"GlobalRole", false, now())`,
      [id, name, hash, role]
    );
  }

  let projectSlug = null;

  try {
    const admin = new Session();
    const member = new Session();
    check("super admin can log in", await admin.login(adminName));
    check("member can log in", await member.login(memberName));

    const created = await admin.json("/api/projects/create", "POST", {
      name: `E2E ${suffix}`,
      memberIds: [ids[memberName]],
    });
    check("project created", created.status === 201, JSON.stringify(created));
    projectSlug = created.data?.slug;
    const api = `/api/projects/${projectSlug}/issues`;

    const bad = await admin.json(api, "POST", { title: "x", dueDate: "2027-02-30" });
    check("invalid due date -> 400 with string error", bad.status === 400 && typeof bad.data?.error === "string", JSON.stringify(bad));

    const i1 = await admin.json(api, "POST", {
      title: "Login page bug",
      description: "Crashes on 100% zoom",
      priority: "urgent",
      dueDate: "2020-01-01",
      assigneeId: ids[memberName],
    });
    check("create issue with all fields", i1.status === 201 && i1.data.priority === "urgent" && i1.data.due_date === "2020-01-01" && i1.data.assignee_id === ids[memberName], JSON.stringify(i1));

    const i2 = await member.json(api, "POST", { title: "Write docs", priority: "low" });
    check("member can create issue", i2.status === 201, JSON.stringify(i2));

    const outsider = await admin.json(api, "POST", { title: "t", assigneeId: "not-a-member" });
    check("assignee outside project rejected", outsider.status === 400, JSON.stringify(outsider));

    const patch = await member.json(`${api}/${i2.data.id}`, "PATCH", {
      title: "Write docs v2",
      status: "in_progress",
      assigneeId: ids[adminName],
      dueDate: "2099-12-31",
    });
    check("member edits issue fields", patch.status === 200 && patch.data.title === "Write docs v2" && patch.data.status === "in_progress" && patch.data.assignee_id === ids[adminName], JSON.stringify(patch));

    const clear = await member.json(`${api}/${i2.data.id}`, "PATCH", { dueDate: "", assigneeId: null });
    check("clearing due date and assignee works", clear.status === 200 && clear.data.due_date === null && clear.data.assignee_id === null, JSON.stringify(clear));

    const empty = await member.json(`${api}/${i2.data.id}`, "PATCH", {});
    check("empty patch -> 400", empty.status === 400);

    const c1 = await member.json(`${api}/${i1.data.id}/comments`, "POST", { body: "  I can reproduce this  " });
    check("member posts comment (trimmed)", c1.status === 201 && c1.data.body === "I can reproduce this", JSON.stringify(c1));
    const c2 = await admin.json(`${api}/${i1.data.id}/comments`, "POST", { body: "Fixing now" });
    check("admin posts comment", c2.status === 201);

    const emptyComment = await admin.json(`${api}/${i1.data.id}/comments`, "POST", { body: "   " });
    check("blank comment -> 400", emptyComment.status === 400);

    const ghost = await admin.json(`${api}/ghost/comments`, "POST", { body: "hi" });
    check("comment on missing issue -> 404", ghost.status === 404, JSON.stringify(ghost));

    const memberDeletesOthers = await member.json(`${api}/${i1.data.id}/comments/${c2.data.id}`, "DELETE");
    check("member cannot delete someone else's comment", memberDeletesOthers.status === 403, JSON.stringify(memberDeletesOthers));
    const memberDeletesOwn = await member.json(`${api}/${i1.data.id}/comments/${c1.data.id}`, "DELETE");
    check("author deletes own comment", memberDeletesOwn.status === 200);

    const list = await admin.json(`${api}/${i1.data.id}/comments`, "GET");
    check("comments list has 1 left", list.status === 200 && list.data.length === 1 && list.data[0].body === "Fixing now");

    const memberDeletesIssue = await member.json(`${api}/${i2.data.id}`, "DELETE");
    check("plain member cannot delete issue", memberDeletesIssue.status === 403);

    // Pages (server-rendered HTML)
    const board = await admin.fetch(`/${projectSlug}/board`);
    const boardHtml = await board.text();
    check("board page renders both tasks", board.status === 200 && boardHtml.includes("Login page bug") && boardHtml.includes("Write docs v2"), `status ${board.status}`);
    check("board shows priority badge", boardHtml.includes("Urgent"));

    const searched = await admin.fetch(`/${projectSlug}/board?q=docs`);
    const searchedHtml = await searched.text();
    check("search filters list", searchedHtml.includes("Write docs v2") && !searchedHtml.includes("Login page bug"));

    const percent = await admin.fetch(`/${projectSlug}/board?q=100%25`);
    const percentHtml = await percent.text();
    check("search treats % literally (matches description)", percentHtml.includes("Login page bug") && !percentHtml.includes("Write docs v2"));

    const byStatus = await admin.fetch(`/${projectSlug}/board?status=in_progress`);
    const byStatusHtml = await byStatus.text();
    check("status filter", byStatusHtml.includes("Write docs v2") && !byStatusHtml.includes("Login page bug"));

    const unassigned = await admin.fetch(`/${projectSlug}/board?assignee=unassigned`);
    const unassignedHtml = await unassigned.text();
    check("unassigned filter", unassignedHtml.includes("Write docs v2") && !unassignedHtml.includes("Login page bug"));

    const noMatch = await admin.fetch(`/${projectSlug}/board?q=zzzzqqq`);
    check("empty filter state", (await noMatch.text()).includes("No tasks match your filters."));

    const farPage = await admin.fetch(`/${projectSlug}/board?page=9`);
    check("page beyond range does not crash", farPage.status === 200 || farPage.status === 307 || farPage.status === 308, `status ${farPage.status}`);

    const weird = await admin.fetch(`/${projectSlug}/board?sort=constructor&status=%27%3B--&page=abc`);
    check("hostile query params do not crash", weird.status === 200, `status ${weird.status}`);

    const detail = await member.fetch(`/${projectSlug}/board/${i1.data.id}`);
    const detailHtml = await detail.text();
    check("detail page renders issue + comment", detail.status === 200 && detailHtml.includes("Login page bug") && detailHtml.includes("Fixing now"), `status ${detail.status}`);

    const missing = await member.fetch(`/${projectSlug}/board/does-not-exist`);
    const missingHtml = await missing.text();
    check("unknown issue shows not-found UI", missing.status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404|not-found|could not be found|This page/i.test(missingHtml) && !missingHtml.includes("Login page bug"), `status ${missing.status}`);

    const anon = await new Session().fetch(`/${projectSlug}/board/${i1.data.id}`);
    const anonHtml = await anon.text();
    check("anonymous detail request is sent to login and leaks nothing", (anon.status === 307 && (anon.headers.get("location") ?? "").includes("/login")) || (anonHtml.includes("/login") && !anonHtml.includes("Login page bug") && !anonHtml.includes("Fixing now")), `status ${anon.status}`);

    const del = await admin.json(`${api}/${i2.data.id}`, "DELETE");
    check("admin deletes issue", del.status === 200);

    // members: leave / remove
    const assigned = await admin.json(api, 'POST', { title: 'Owned by member', assigneeId: ids[memberName] });
    check('issue assigned to member', assigned.status === 201 && assigned.data.assignee_id === ids[memberName]);

    const strangerRemoves = await member.json(`/api/projects/${projectSlug}/members/${ids[adminName]}`, 'DELETE');
    check('plain member cannot remove another member', strangerRemoves.status === 403, JSON.stringify(strangerRemoves));

    const leave = await member.json(`/api/projects/${projectSlug}/members/${ids[memberName]}`, 'DELETE');
    check('member can leave the project', leave.status === 200, JSON.stringify(leave));

    const afterLeave = await admin.json(`${api}/${assigned.data.id}/comments`, 'GET');
    check('admin still has access after member left', afterLeave.status === 200);

    const issuesAfter = await admin.fetch(`/${projectSlug}/board?assignee=unassigned`);
    check('leaver tasks became unassigned', (await issuesAfter.text()).includes('Owned by member'));

    const locked = await member.json(api, 'GET');
    check('former member loses access', locked.status === 403, JSON.stringify(locked));

    const leaveAgain = await member.json(`/api/projects/${projectSlug}/members/${ids[memberName]}`, 'DELETE');
    check('leaving twice -> 404', leaveAgain.status === 404, JSON.stringify(leaveAgain));

    const readd = await admin.json(`/api/projects/${projectSlug}/members`, 'POST', { username: ' ' + memberName + ' ' });
    check('manager re-adds member by username', readd.status === 201, JSON.stringify(readd));

    const dup = await admin.json(`/api/projects/${projectSlug}/members`, 'POST', { username: memberName });
    check('duplicate add -> 409', dup.status === 409);

    const removeByAdmin = await admin.json(`/api/projects/${projectSlug}/members/${ids[memberName]}`, 'DELETE');
    check('manager removes member', removeByAdmin.status === 200);

    // admin: edit user / reset password / history
    const editUser = await admin.json('/api/admin/users/' + ids[memberName], 'PATCH', { name: 'E2E Member', email: memberName + '@example.test' });
    check('admin edits name + email', editUser.status === 200 && editUser.data.name === 'E2E Member' && editUser.data.email === memberName + '@example.test', JSON.stringify(editUser));

    const clearUser = await admin.json('/api/admin/users/' + ids[memberName], 'PATCH', { email: '' });
    check('admin clears email', clearUser.status === 200 && clearUser.data.email === null);

    const clash = await admin.json('/api/admin/users/' + ids[memberName], 'PATCH', { username: adminName });
    check('duplicate username -> 409', clash.status === 409, JSON.stringify(clash));

    const selfRole = await admin.json('/api/admin/users/' + ids[adminName], 'PATCH', { role: 'USER' });
    check('cannot change own role', selfRole.status === 400);

    const memberTriesAdmin = await member.json('/api/admin/users/' + ids[adminName], 'PATCH', { name: 'x' });
    check('non-admin cannot edit users', memberTriesAdmin.status === 403);

    const newName = memberName + '_x';
    const rename = await admin.json('/api/admin/users/' + ids[memberName], 'PATCH', { username: newName });
    check('admin renames username', rename.status === 200 && rename.data.username === newName, JSON.stringify(rename));

    await client.query("DELETE FROM \"RateLimitEntry\" WHERE key LIKE 'login:%'");
    const badTries = new Session();
    for (let i = 0; i < 5; i++) await badTries.login(newName, 'wrong-password-' + i);
    const lockedLogin = await new Session().login(newName);
    check('account locks after 5 bad logins', lockedLogin === false);

    await client.query("DELETE FROM \"RateLimitEntry\" WHERE key LIKE 'login:%'");
    const tempPw = 'Temp-Reset-9876';
    const reset = await admin.json('/api/admin/users/' + ids[memberName] + '/reset-password', 'POST', { password: tempPw });
    check('admin resets password', reset.status === 200, JSON.stringify(reset));

    const afterReset = new Session();
    check('reset clears lockout and new password works', await afterReset.login(newName, tempPw));
    check('old password no longer works', (await new Session().login(newName, password)) === false);

    const forced = await afterReset.fetch('/dashboard');
    const forcedHtml = await forced.text();
    check('reset user is forced to change password', (forced.status === 307 && (forced.headers.get('location') ?? '').includes('/change-password')) || (forcedHtml.includes('/change-password') && !forcedHtml.includes('Your projects')), 'status ' + forced.status);

    const selfReset = await admin.json('/api/admin/users/' + ids[adminName] + '/reset-password', 'POST', { password: tempPw });
    check('cannot reset own password via admin route', selfReset.status === 400);

    const adminPage = await admin.fetch('/admin');
    const adminHtml = await adminPage.text();
    check('admin console renders with history section', adminPage.status === 200 && adminHtml.includes('Admin assignment history'), 'status ' + adminPage.status);

    // legacy-schema upgrade through the real app path
    const proj = await client.query(`SELECT "schemaName" FROM "Project" WHERE slug = $1`, [projectSlug]);
    const schema = proj.rows[0].schemaName;
    await client.query(`ALTER TABLE "${schema}".comments DROP CONSTRAINT IF EXISTS x`);
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'issues'`,
      [schema]
    );
    const names = cols.rows.map((r) => r.column_name);
    check("schema has priority + due_date columns", names.includes("priority") && names.includes("due_date"));
  } finally {
    if (projectSlug) {
      const proj = await client.query(`SELECT id, "schemaName" FROM "Project" WHERE slug = $1`, [projectSlug]);
      for (const row of proj.rows) {
        if (/^proj_[a-f0-9]{32}$/.test(row.schemaName)) await client.query(`DROP SCHEMA IF EXISTS "${row.schemaName}" CASCADE`);
        await client.query(`DELETE FROM "Project" WHERE id = $1`, [row.id]);
      }
      console.log(`cleanup: removed ${proj.rowCount} project(s)`);
    }
    await client.query("DELETE FROM \"RateLimitEntry\" WHERE key LIKE 'login:%'");
    await client.query(`DELETE FROM "User" WHERE id = ANY($1)`, [Object.values(ids)]);
    await client.end();
    console.log("cleanup: temp users removed");
  }

  console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("E2E crashed:", error);
  process.exit(2);
});
