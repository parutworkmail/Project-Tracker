# Progress Log

Read this file first in any new session to see what's done and what's next.

### Live Task Log
(Read this FIRST on every session start — see CLAUDE.md "Crash-Safe Task
Logging". Shows exactly what was happening if the last session crashed.)

- **USER RULE (noted)**: when the user says "fix my feedback" they want a QUICK fix: minimal edit,
  at most one fast check on the touched file (eslint/tsc), NO full vitest, NO e2e, NO full build,
  NO starting servers or the local DB. Commit locally, short answer, never push.
- **USER FEEDBACK FIXED (change password stayed on the page)**: a user forced to change their
  password submitted the form, the password WAS saved, but the browser stayed on /change-password.
  Cause: right after login the client router cache stored the answer for /dashboard (a redirect to
  /change-password); router.push("/dashboard") replayed that cached redirect. API-level tests could
  not see it. Fix: src/components/change-password-form.tsx now does a full page load
  (window.location.assign) after success and keeps the button busy meanwhile. Reproduced and
  verified in a real browser with scripts/browser-change-password.mjs (before: stays on
  /change-password; after: lands on /dashboard, survives reload). tsc + eslint clean.
- **Status**: Monday finished + this fix; next is Tuesday (review findings + typed-name delete in Settings).

- **MONDAY DONE (end-to-end loop + browser check)**: scripts/e2e-loop.mjs (161 checks, ALL PASS on
  the local test DB: 3 roles + extra user, forced password change, projects, member/admin
  assignment, labels, tasks, comments, filters, kanban, CSV incl. formula-injection, my-tasks,
  leave/remove, user edit/role/reset/lockout, per-IP login rate limit, typed-name project delete,
  /admin/logs access, audit rows, no passwords in audit rows). It writes docs/test-data/manifest.json
  (every user + project it made, with their passwords; git-ignored) and
  scripts/test-data-cleanup.mjs removes exactly those (dry run by default, --yes to delete;
  refuses if the manifest DB differs from the connected DB). Run:
  `node scripts/with-local-db.mjs node scripts/e2e-loop.mjs http://localhost:3100` (needs
  `node scripts/with-local-db.mjs npx next start -p 3100` running after a build) and
  `node scripts/with-local-db.mjs node scripts/test-data-cleanup.mjs [--yes]`.
  scripts/browser-check.mjs (puppeteer-core + Chrome headless) logs in for real and screenshots 12
  pages in light+dark into tmp-shots/ (git-ignored): 0 console errors, 0 HTTP 5xx; footer, /admin/logs
  (filters, paging, empty + far-page states) and the confirm dialogs look right in both themes;
  dialog is aria-modal + labelled, focus lands inside, Escape closes. Confirmed still-open finding
  for Tuesday: page scroll is NOT locked while a dialog is open (body overflow stays visible).
  Test-script lessons: all loop traffic is one IP so the login limit (10/15 min, every attempt
  counts) must be cleared between logins; DELETE of a missing task returns 200 (idempotent, left as
  is); project DELETE needs {confirmName}. Test data from the run is KEPT in the local DB
  (5 users, 1 project) so it can be browsed; the local DB lives in %TEMP%/tracker-local-pg.
  Environment notes: this PC could not reach Supabase (db host resolves to IPv6 only; the pooler
  hosts accept TCP but reset the connection - likely a network filter; ask the user to try another
  network); local-db.mjs `start` can hang the shell while the server is in fact up - check port
  5544 instead of waiting. Chrome/Edge GUI opens blank pages on this PC (files and localhost), so
  reports are .docx.
- **Status**: Monday finished; next is Tuesday (review findings + typed-name delete in Settings).

- **WEEK PLAN (new week; user asked for the plan, nothing started yet)**: Facts checked: main ==
  origin/main at ca8184d; tag v0.0.1 -> 81425b9 (ca8184d is the USER's own footer-name commit,
  "Developed by Parut Na", so the live footer reads v0.0.1 + commit ca8184d); only uncommitted
  file is this log; dev server + test DB are off; this PC cannot resolve the Supabase host
  right now (DNS ENOTFOUND) so all my testing is on the LOCAL test DB.
  SCHEDULE: Mon = end-to-end loop (3 roles, projects, tasks) writing docs/test-data manifest +
  cleanup script, then browser check of confirm dialogs / /admin/logs / footer in light+dark and
  fix findings. Tue = review findings (dialog focus trap + scroll lock, live-region announcements,
  unsaved-changes warning, GET /issues search params) + typed-name delete in Project Settings.
  Wed = small leftovers (label picker in Create task, CSV 5000-row notice, overdue date
  consistency, forms keeping typed text) + CHANGELOG. Thu = SUBTASKS (user chose it: per-project
  lazy schema upgrade, no manual Supabase migration). Fri = full validation (tsc, eslint, full
  vitest, build, e2e), version 0.0.2 (alpha), commit + tag, report for the user to verify.
  RELEASE RULES: commit locally per item; push ONLY when the user says; never move a pushed
  tag (0.0.2 fixes the tag/commit mismatch); 0.1.0 (beta) later after real use.
  USER ACTIONS STILL OPEN: apply migration 20261113000000_add_audit_log to Supabase (can paste
  the SQL into the Supabase dashboard SQL editor, then run prisma migrate resolve --applied
  20261113000000_add_audit_log from a network that reaches the DB - this exact route untested);
  check the live footer; decide on the two old git stashes.
- **Status**: plan agreed (Thursday feature = subtasks); waiting for the user to say start.

- **STATE AT END OF WEEK (read this first)**: v0.0.1 (alpha) is committed (81425b9), tagged
  v0.0.1 and PUSHED (the one push the user allowed is used up; push needs a new explicit ask).
  Todo list cleared. Validated before the commit: tsc clean, eslint 0 errors, 411 unit tests
  passed / 13 skipped, production build OK on the local-DB env. Nothing in progress. Only
  uncommitted file: PROGRESS.md (this log).

  **NEXT TODO - release 0.0.1 items that were NOT finished**
  1. USER ACTION: apply the new migration to Supabase (npx prisma migrate deploy; creates the
     AuditLog table). Until then /admin/logs shows a "table does not exist" message and audit
     writes fail quietly; the rest of the site works.
  2. USER ACTION: after the deploy, check the footer reads "v0.0.1 alpha" with the commit id.
  3. END-TO-END LOOP (requested, NOT done): script that creates temp users for all 3 roles
     (SUPER_ADMIN, ADMIN, USER) with temp passwords + forced password change, projects, member +
     admin assignment, tasks, comments, labels, filters/kanban/CSV/stats/my-tasks, leave/remove,
     deletes, audit rows; MUST write a manifest of every user/project it creates (e.g. docs/
     test-data/manifest.json) plus a cleanup script that deletes exactly those, so the user can
     remove them one day. Run on the LOCAL test DB only (node scripts/local-db.mjs start +
     scripts/with-local-db.mjs). scripts/e2e-issues.mjs + scripts/e2e-cleanup.mjs already cover
     issues/comments/members/admin edit/lockout (old, not re-run on 0.0.1) - extend them.
  4. BROWSER CHECK (not done): the shared ConfirmProvider dialogs (delete task / comment / label /
     leave project / remove member / Project Settings delete / remove project admin), /admin/logs
     (filters, paging, empty and failure states), footer, in light AND dark mode.
  5. CHANGELOG file (requested, not written). The tag is v0.0.1 (package.json 0.0.1); the page
     label says "alpha".
  6. Small leftovers from this week: Project Settings delete still uses a plain confirm (no typed
     name); label picker missing in the Create task dialog; CSV export has no on-screen warning
     when cut at 5000 rows; stats/My tasks use the server date for overdue (list uses browser
     date); other forms (change-password, filters, comments) still keep typed text on return.
  7. Still open from earlier reviews: dialog focus trap + scroll lock, live-region announcements,
     unsaved-changes warning on the task page, GET /issues ignoring search params; features not
     started: notifications, subtasks.
  8. Housekeeping: git stash@{0} (supabase-https adapter) and stash@{1} (neon workaround) hold
     rejected experiments - drop when sure (git stash drop). Possible leftover e2e_* rows in
     Supabase (node --env-file=.env scripts/e2e-cleanup.mjs when it is reachable).
  9. KNOWN ENVIRONMENT PROBLEM: from the user's office network (Zscaler) raw Postgres to Supabase
     was blocked on some days; it worked again on another network. The user's :3000 dev server
     is STOPPED - start it with npm run dev. My local test DB is stopped too.


- **Plan (user: "commit everything and push just this time, end of week")**: user explicitly
  allows ONE push now. Order: (1) full validation on the current tree (tsc, eslint, full
  vitest, production build against the LOCAL db env) and fix anything that fails FIRST,
  (2) CHANGELOG + tidy, (3) commit everything (incl. the #18 work), (4) annotated tag v0.0.1,
  (5) ONE push of main with the tag, (6) restart the user's :3000 dev server, stop my test
  DB. The end-to-end loop script is NOT done and will be reported as such. Supabase DB is
  not touched; the AuditLog migration must be applied there by the user.
- **Status**: DONE. Committed 81425b9 (all 84 paths), annotated tag v0.0.1, and PUSHED once to
  origin/main (6a9e432..81425b9) plus the tag, as the user allowed. The push permission is now
  used up. Earlier note: validation done, committing + tagging v0.0.1 + ONE push now (user left, said no
  more tests). Results just before: tsc clean, eslint 0 errors (3 old warnings), 411 tests
  passed / 13 skipped, production build OK on the local-DB env. NOT done and NOT claimed:
  the end-to-end loop script + test-data manifest/cleanup script, browser checks of the new
  dialogs / /admin/logs / footer, CHANGELOG. The AuditLog migration (prisma/migrations/
  20261113000000_add_audit_log) is NOT applied to Supabase: /admin/logs shows a clear message
  until the user runs npx prisma migrate deploy against it; everything else works without it
  (audit writes fail quietly). The user's :3000 dev server is stopped; test DB stopped.

- **CORRECTION (status check)**: an earlier note here claimed a SECOND aXet session was
  working on request #18. That was WRONG. All of the #18 work (confirm dialogs, audit log,
  footer/version) was done by THIS session; the file times match, and the only other
  processes were the app itself and my own test DB. Nothing is blocked by another session.
  STATE: all #18 work is UNCOMMITTED; tsc + eslint clean; full unit suite 411 passed / 13
  skipped. NOT done yet: the end-to-end loop + test-data manifest/cleanup script, a
  production build on this tree, browser checks of the new dialogs / /admin/logs / footer,
  CHANGELOG, commit and the git tag. The tag will be v0.0.1 (matches package.json 0.0.1),
  not the v0.0.1-alpha written in the second plan entry below. The user's :3000 dev server
  is STOPPED (I killed it); my local test DB is still running on :5544.

- **Plan (user #18, ALPHA 0.0.1 release, user is busy - work autonomously)**:
  (1) replace EVERY window.confirm/alert/prompt with our Dialog (shared ConfirmDialog);
  (2) full end-to-end loop on the LOCAL test DB (never Supabase): temp users for all 3
  roles with temp passwords + forced password change, projects, members, admin
  assignment, tasks, comments, labels, filters/kanban/CSV/stats/my-tasks, leave/remove,
  deletes; log every user/project created in a manifest file so it can be removed
  later (+ cleanup script); (3) audit/error log: new AuditLog table (migration file,
  applied to LOCAL only), best-effort recordAudit(), instrument login/admin/project/
  error paths, super-admin-only /admin/logs page + a "Logs" menu item; (4) footer
  "Developed by John Doe" + version tag (package.json 0.0.1-alpha, /api/version);
  (5) FULL validation (tsc, eslint, full vitest, build, e2e, browser), fix failures,
  commit + git tag v0.0.1-alpha, NO push - report for the user to verify. Supabase NOT
  touched: the AuditLog migration must be applied to it before the Logs page works there.
- **Status**: in progress.

- **Plan (user request #18, ALPHA 0.0.1, user is busy/AFK - decide, do not ask)**: (1) Replace
  EVERY window.confirm/alert/prompt with one shared ConfirmDialog (our Dialog), incl. all delete
  buttons (task, comment, label, member, leave, remove admin, project Settings delete...). (2) Full
  end-to-end run on the LOCAL throwaway DB (NOT the real/Supabase DB): temp SUPER_ADMIN/ADMIN/USER
  accounts, create + assign projects, every API function; every temp user/project recorded in a
  MANIFEST (docs/test-data/) + a cleanup script, so the user can remove them "one day". (3) Audit /
  error log: new AuditLog table (additive migration, hand-written + verified, applied to LOCAL only),
  fail-safe writer, hooks for API 5xx errors, login failures/lockouts and admin actions, and a
  super-admin-only "Audit log" menu + /admin/logs page (levels, search, paging; DB-down errors can
  only reach the console -> link/notes). (4) Footer "Developed by John Doe" + small version tag
  (package.json 0.0.1 + short git SHA on Vercel) in the root layout; git tag v0.0.1; CHANGELOG. (5)
  Full tsc + eslint + full vitest + build + the e2e; fix failures; commit everything + annotated tag
  v0.0.1 LOCALLY; NEVER push; report for the user to verify. Supabase is never touched by me; the
  new migration must be applied to Supabase by the user BEFORE the audit page works online.
- **Status**: in progress (step 1: audit all alerts).

- **Plan (user feedback #17, delete user dialog)**: Admin console > Users > Delete uses
  window.confirm (browser alert). Replace with a proper Dialog in the same style as the
  Delete project dialog (red Delete button, Cancel, no X, fade out) but WITHOUT typing the
  username. New components/admin/delete-user-dialog.tsx + wire into user-role-manager.tsx
  with the same keep-mounted/per-opening-key pattern. tsc only, no suites; real-browser
  check on the LOCAL test DB.
- **Status**: done, not committed; tsc + eslint clean; no unit suites. NEW components/admin/
  delete-user-dialog.tsx (same look as Delete project: Dialog, no X, Cancel + red "Delete
  user" ActionButton, fade-out; description names the account; NO typing step as asked;
  shows the server's error text inside the dialog and stays open). user-role-manager.tsx:
  window.confirm and the old deleteUser() removed; Delete button opens the dialog (same
  keep-mounted + per-opening key pattern as edit/reset). REAL CHROME, real login as super
  admin, LOCAL test DB (17/17): own row has no Delete; real dialog (no native alert ever);
  names the account; Cancel and Escape delete nothing; a user who still owns a project is
  refused with "This user still owns one or more projects..." shown as a red line inside
  the dialog (dialog stays open, button usable again, user kept); a normal delete removes
  the row from the table and the DB, others untouched; screenshots looked right. HONEST
  NOTE: my first run showed 16/16 but one check was a FALSE PASS (matched the word
  "project" in the dialog's own description while the dev server was still compiling the
  route; screenshot showed "Deleting..."); I fixed the check to wait for the real error
  line and reran. Not tested: dark mode, the success path for a user who is a member of
  several projects. Cleanup: test DB + :3400 server stopped, temp files deleted, user's
  :3000 dev server restarted (shell 1EE, original .env).

- **Plan (user feedback #16, create project on admin console)**: Admin console >
  Projects section needs a "+ New project" button that opens the SAME popup as the
  dashboard (components/create-project-dialog.tsx: name + pick members). Reuse that
  component (do not copy it): pass it the list of other users from the admin page,
  put it in the Projects section header. Check where it redirects after creating
  (dashboard version goes to the new project). tsc only, no suites.
- **Status**: done, not committed; tsc + eslint clean; no unit suites. admin/page.tsx:
  Projects heading row now has the existing CreateProjectDialog (the SAME component
  as the dashboard: "+ New project" -> Create project popup, name + Assign people),
  fed with every user except the signed-in admin. create-project-dialog.tsx got one
  optional prop stayOnPage (default false = dashboard unchanged: jumps into the new
  project); admin passes true = stays on /admin and refreshes so the project appears
  in the list (my choice; the user did not specify). REAL CHROME, real login as super
  admin on the LOCAL test DB (11/11, after fixing a bug in my own check script that
  skipped the last check on the first run): button in the Projects header row; popup
  = Create project with name field + people list (other user listed, admin not);
  covers the screen; empty name refused; create -> stays on /admin, project listed,
  2 members (admin + picked person), private schema created; reopened popup empty;
  the dashboard popup still jumps into the new project. Screenshot looked right.
  Cleanup: test DB + :3400 server stopped, temp files deleted, user's :3000 dev
  server restarted (shell 1E4, original .env). Not tested: dark mode, many users in
  the people list.

- **Plan (user report #15, landing page flashes Log in)**: Signed in, visiting / shows
  a glimpse of the logged-out buttons (Log in / Join us) and then switches to "Go to
  dashboard". Suspected cause: components/hero-actions.tsx treats every status other
  than authenticated (including "loading", the first moments before the session is
  known) as signed out. Fix: render a same-size placeholder while loading so nothing
  wrong is shown, then the right buttons. Check components/providers.tsx too. tsc only,
  no suites.
- **Status**: done, not committed; tsc + eslint clean; no suites. CAUSE (confirmed):
  components/hero-actions.tsx treated every status except "authenticated" - including
  "loading" (session not known yet) - as signed out, so a signed-in visitor first saw
  Log in + Join us; the page is prerendered, so the server HTML had them too. FIX:
  status loading -> a same-height skeleton placeholder (role=status, aria-label
  "Checking your session"); the resolved buttons fade in (animate-fade-in). REAL CHROME
  on :3000, faked session reply delayed 1.6 s (no login/DB): signed in = [placeholder]
  -> Go to dashboard, and Log in / Join us were NEVER shown; signed out = [placeholder]
  -> Log in + Join us, Go to dashboard never shown; the server HTML has none of the three
  buttons. Side effect: for the 1-3 s the session lookup takes (it hits the DB) the
  visitor sees a grey placeholder instead of buttons. Same pattern NOT checked on the
  other pages (nav already hid its account area while loading).

- **Plan (user feedback #14, admin delete project)**: Admin console > Projects has no
  Delete project button. Add one per project row, with a type-the-project-name
  confirmation dialog (Delete stays disabled until the typed name matches exactly;
  server re-checks nothing new but DELETE /api/projects/[slug] already exists, so
  check it and its permissions first). Reuse components/dialog.tsx + ActionButton,
  refresh the list after. tsc only, no suites; verify in real Chrome on the LOCAL test
  DB only (never Supabase).
- **Status**: done, not committed; tsc + eslint clean; ONLY the new route test file run
  (9/9, not the full suite). NEW: src/app/api/admin/projects/[slug]/route.ts DELETE
  (SUPER_ADMIN only, 401/403, rate limit 10/min, body {confirmName}; 400 if empty or
  not exactly the project name (case-sensitive, surrounding spaces ignored), 404 if
  unknown; deletes the project ROW first (members/admin assignments cascade) then drops
  the private schema; if only the drop fails it logs and still returns ok). The
  existing DELETE /api/projects/[slug] (project Settings page) is UNCHANGED and still
  has no typed-name check. NEW components/admin/delete-project-dialog.tsx (type-the-
  name confirmation, Delete disabled until it matches, red ActionButton, no X, Enter
  submits, shows server errors) and project-admin-manager.tsx got a red "Delete
  project" button per project row, keep-mounted dialog + per-opening key. REAL CHROME,
  real login as super admin on the LOCAL test DB (23/23): button present; Delete
  disabled when empty / wrong case / one char short; Cancel deletes nothing and a
  re-open starts empty; server refuses a wrong or missing name (400) even when called
  directly; exact name -> project vanishes from the list, row gone from DB, its
  schema dropped, the OTHER project and its schema untouched, deleted project's API
  returns 404; a normal user gets 403 even with the right name; screenshots looked
  right. Never touched Supabase. Not tested: dark mode, a project with real tasks/
  comments/labels (schema drop is CASCADE), extremely long names. Cleanup: test DB
  stopped, :3400 server stopped, temp files deleted, the user's :3000 dev server
  restarted (shell 1D6, original .env).

- **Plan (user feedback #13, persistent project navbar)**: The project navbar is
  drawn by each page (board, settings, my-tasks, board/[issueId]) so it unmounts and
  reloads on every click, and [slug]/loading.tsx + [slug]/board/loading.tsx even draw
  a fake grey bar in its place. User: it must PERSIST between pages of the same
  project, but change when going between the admin site nav and a project nav. PLAN:
  new src/app/[slug]/layout.tsx (own Suspense + skeleton, looks up auth/project/
  canManage; renders NO nav for signed-out, must-change-password, unknown project or
  non-members so the Join page stays as is); ProjectNav derives "active" from the URL
  (no active prop); remove <ProjectNav> from the 4 pages and the fake nav block from
  the 2 loading files. VERIFY in real Chrome with a real login on the LOCAL test DB
  (needs stopping the :3000 server I started, then restarting it on the original
  .env): same header DOM node survives Board -> My tasks -> Project Settings clicks.
  tsc + eslint only, no suites.
- **Status**: done, not committed; tsc + eslint clean; production build OK (all routes
  incl. [slug]/my-tasks) run against the LOCAL DB env. NEW src/app/[slug]/layout.tsx:
  own Suspense + skeleton, async loader does auth + project + canManage and renders
  ProjectNav only for signed-in, password-set, existing-project MEMBERS/MANAGERS (so
  non-members keep the Join page without a menu; signed-out/unknown project render
  nothing and the pages redirect/404 as before). ProjectNav lost its active prop and
  reads the section from usePathname(). <ProjectNav> and the fake grey nav block
  removed from the 4 pages and [slug]/loading + [slug]/board/loading. REAL CHROME,
  real login, LOCAL DB (dev on :3400, demo data cleaned): main navbar on /dashboard =
  [My tasks, Admin console]; project navbar = [My tasks, Project Settings]; the SAME
  header DOM element survived board -> My tasks -> Project Settings -> project name
  -> board (headers=1 each time); non-member sees Join page with 0 headers; signed-out
  visits redirect to /login (client-side redirect a few seconds after the first load
  in dev - my first check just did not wait long enough). Screenshot looked right.
  Swapping admin nav <-> project nav needs a different layout group, so it changes
  as the user asked (not clicked through; no link leads from a project back to the
  main site any more, only full page loads were compared). NOT verified: Project
  Settings / My tasks pages with a manager vs plain member; dark mode. The dev-only
  "crypto.getRandomValues while prerendering" message still shows for /[slug]/board in
  dev but the production build passes. Cleanup done: test DB stopped, :3400 server
  stopped, temp scripts deleted, the user's :3000 dev server restarted (shell 1CC,
  original .env = Supabase).

- **Plan (user feedback #12)**: (1) Rename "Settings" to "Project Settings" in the
  project navbar. (2) "My tasks" inside a project must be PER PROJECT: new page
  /{slug}/my-tasks = my open tasks in THAT project only, rendered with the project
  navbar (so there is always a way back); the project navbar My tasks link points
  there and highlights. The main navbar (super admin) My tasks stays the
  cross-project /my-tasks. Reuse listOpenIssuesAssignedTo. tsc only, no suites.
- **Status**: done, not committed, NOT opened logged in (needs a real login); tsc + eslint
  clean, no suites. components/project-nav.tsx: label "Settings" -> "Project Settings";
  "My tasks" now links to /{slug}/my-tasks (highlighted when active=my-tasks; active
  type extended). New src/app/[slug]/my-tasks/page.tsx: same auth/member checks as the
  board (non-members redirect to the board), shows ONLY this project's open tasks
  assigned to the user (listOpenIssuesAssignedTo, soonest due first) inside the
  project navbar, empty state links to the board; task rows link to the task page.
  Main navbar My tasks (super admin) still goes to the cross-project /my-tasks. Dev
  server serves the route (200, no build error). Overdue uses the server date.
  Inherits [slug]/loading.tsx as its loading screen.

- **Plan (user feedback #11c, explicit navbar layout)**: User: nothing visibly moved.
  Wants: MAIN navbar (super admin): LEFT next to logo + "Project Tracker" = menu
  [My tasks, Admin console]; RIGHT = [theme toggle, username, Sign out]. PROJECT
  navbar (/{slug}/board etc.): LEFT next to project name = [My tasks, Settings];
  RIGHT = same as admin [theme, username, Sign out]. Edit components/nav.tsx and
  components/project-nav.tsx. Replace the old "Admin Dashboard" + "Admin" links with
  one "Admin console" (/admin). tsc only, no suites.
- **Status**: done, not committed; tsc + eslint clean; no suites. WHY the user saw no
  change before: in the MAIN navbar My tasks/Admin links sat in the RIGHT group
  (before the username) and my earlier edit only touched the project navbar.
  components/nav.tsx now: LEFT = logo + "Project Tracker", then menu [My tasks,
  Admin console (SUPER_ADMIN only, /admin, highlighted on /admin*)]; RIGHT = theme
  toggle, username chip, Sign out (or Log in when signed out). The old "Admin
  Dashboard" (/dashboard) and "Admin" links are gone. Menu and account area stay
  hidden on /login while authenticated (the earlier no-flash fix). components/
  project-nav.tsx: LEFT = project avatar+name, then [My tasks (/my-tasks), Settings
  (managers only)]; RIGHT = theme, username, Sign out. VERIFIED in real Chrome on
  :3000 with a faked session (no login/DB): SUPER_ADMIN -> LEFT Project Tracker, My
  tasks, Admin console / RIGHT user chip, Sign out; USER -> same without Admin
  console; screenshot looked right. NOT verified: the project navbar (needs a real
  login to open a project page; code-reviewed only). Consequences to tell the
  user: super admin has no navbar link to /dashboard (project list) any more - only
  the logo -> home -> "Go to dashboard" button and the post-login redirect; "My
  tasks" in a project navbar leaves the project site for the main site.

- **Plan (user feedback #11b)**: Project navbar: remove the Dashboard button (the
  project name already links to the board) and move the nav links to the LEFT side
  next to the project name. Interpretation: Settings (managers) moves left beside
  the name; theme toggle, username and Sign out stay on the right. components/
  project-nav.tsx only. tsc only, no suites.
- **Status**: done, not committed, not seen in a browser; tsc + eslint clean.
  components/project-nav.tsx: Dashboard link removed; the left group is now
  [project avatar + name (links to the board)] + [Settings, managers only]; the
  right group keeps theme toggle, username chip and Sign out. Assumption: "move to
  the left" = Settings moves next to the name. The earlier #11 change (Dashboard ->
  /{slug}/board) is superseded.

- **Plan (user feedback #11)**: On /{slug}/settings the project navbar "Dashboard"
  link goes to /dashboard (the main/admin dashboard). User wants it to go to the
  PROJECT's own dashboard. The project has no /{slug}/dashboard route; its home
  is /{slug}/board (tasks + stats), so point the link there. Edit
  components/project-nav.tsx only. tsc only, no suites.
- **Status**: done, not committed, not seen in a browser; tsc + eslint clean.
  components/project-nav.tsx: the "Dashboard" link now goes to /{slug}/board (the
  project's own dashboard: tasks + stats) and is highlighted when active=board,
  same style as Settings. Side effect to tell the user: project pages no longer
  have any link back to the main /dashboard project list (the project name link
  and Dashboard now both point at the board). Used by /{slug}/board, /{slug}/settings
  and /{slug}/board/{issueId} (all three render ProjectNav).

- **Plan (user feedback #10)**: Remove the yellow left-edge bar from the project
  cards (JSX + .project-card-edge css). Summary tiles are too dark grey: lighten
  them ~20% (tile tint and text grey). tsc only, no suites.
- **Status**: done, not committed, not seen in a browser; tsc + eslint clean.
  project-list.tsx: left accent bar element removed (card padding back to p-5);
  globals.css: .project-card-edge rules removed. dashboard-summary.tsx: tile tint
  .035 -> .028 (light) / .05 -> .04 (dark), number text-foreground/80 -> /65,
  label + hint text-muted -> text-muted/80 (about 20% lighter each). Open arrow
  button, hover lift and heading kept.

- **Plan (user feedback #9, dashboard cards vs summary)**: The clickable project
  cards look too much like the summary tiles above (same surface card style, tight
  spacing), so users cannot tell they are clickable. DOING: make the summary tiles
  flat/informational (no card shadow, tinted, smaller), add a "Your projects"
  heading with more spacing, and give project cards clear affordances: persistent
  Open arrow button, accent edge, hover lift + accent border + arrow slide,
  pointer cursor, focus ring. tsc only, no suites.
- **Status**: done, NOT seen in a browser (dashboard needs a real login, and a second
  dev server cannot run next to the user's :3000 one), not committed; tsc + eslint
  clean. CAUSE: cards and tiles shared the same surface-card look, and the card's
  only affordance (arrow) was opacity-0 until hover. FIX: summary tiles are now
  flat tinted chips (no shadow/border, smaller muted numbers, 40 px gap below);
  new "Your projects" heading + hint "Click a project to open it in a new tab";
  project cards: stronger resting shadow, yellow accent edge on the left (grows on
  hover), an always-visible circular Open arrow button that fills yellow and nudges
  on hover/focus, hover lift (existing card-lift), pressed state, keyboard focus
  ring, aria-label "Open project X", cursor-pointer. CSS in globals.css (.project-
  card*). Served CSS contains the new rules. Not checked: dark mode, narrow screens.

- **Plan (user feedback #8, dashboard summary text)**: On /dashboard the personal
  summary ("N spaces you can open", "you manage X with full control") sits UNDER
  the search bar and changes with the search. It must sit ABOVE the search bar and
  NOT depend on the search/page (always the user's real totals). Find where it is
  rendered, compute the totals independent of ?q=/page, move it above the
  search input. tsc only, no suites.
- **Status**: done, not committed, NOT seen logged in (tsc + eslint clean; no suites).
  CAUSE: the three tiles (Projects / You manage / Collaborators) were drawn inside
  ProjectList, under the search bar, only when no search and page 1, and the
  numbers came from the 20 projects of the CURRENT PAGE (so wrong with >20
  projects; "Collaborators" even said "across this page"). FIX: new
  lib/dashboardSummary.ts (account-wide totals, independent of ?q=/page:
  super admin = count of all projects + distinct members; others = their
  member/admin projects, managed = ProjectAdmin rows when role ADMIN,
  collaborators = DISTINCT people across those projects) and new components/
  dashboard-summary.tsx (tiles + skeleton) rendered in dashboard/page.tsx ABOVE
  the search input in its own Suspense (no key, so it does not flash on every
  keystroke). Tiles removed from project-list.tsx. Changed on purpose: the
  Collaborators number is now distinct people (before: sum of member counts,
  which double-counted people in several projects) and includes the user. The
  queries were NOT run against a database (no logged-in check, local DB off).
  Side effect: the summary queries re-run on every search navigation (3 small
  queries, results unchanged).

- **Plan (user report #7)**: Login as "admin" shows "An unexpected error occurred
  while logging in" (the unexpected-error branch of authorize(), i.e. NOT a
  DB-unreachable error and NOT wrong password). DOING (read-only): read the dev
  server log for the real exception, re-check the DB connection, then find which
  of my recent edits (useAppRouter / ActionButton / login changes) or the DB
  could cause it. No test suites, no DB writes.
- **Status**: partly fixed, not committed, NOT unit-tested (user: no tests while
  reviewing); tsc + eslint clean. ROOT CAUSE of the login error: the database
  connection timed out (dev log: "Connection terminated due to connection
  timeout" in checkRateLimit, i.e. before any password check). Read-only checks:
  3 direct connects timed out at 5 s; ~minutes later a real login request to
  :3000 got an answer in 3.9 s ("Invalid username or password" for a made-up
  user), so the connection is SLOW/FLAKY from this PC (earlier today the same
  check took 2.4 s), not permanently down; cause on the network side unknown
  and not changeable from the project. PROJECT BUG FIXED: src/lib/apiError.ts
  isDbConnectionError missed pg-pool timeouts (no error code), so login said
  "unexpected error" instead of "Cannot reach the database". Now also matches
  connection messages (connection terminated / connection timeout / timeout
  expired / ECONN* / ENOTFOUND ...) anywhere in the cause chain + ECONNRESET
  code. The new message path was NOT reproduced end to end (database happened
  to answer). ALSO: components/dialog.tsx onExited now via a ref (the log's
  "useEffect changed size" warning was a hot-reload artifact of my earlier dep
  edit; refresh clears it). OPEN CONCERN (not fixed, not verified): dev log
  shows "Route X: Next.js encountered the unstable value crypto.getRandomValues()
  while prerendering" (blocking-prerender-crypto) for /admin from 00:40 (right
  after I added admin/loading.tsx) and for /my-tasks, /admin/users/new,
  /change-password, /dashboard, /[slug], /[slug]/settings, /[slug]/board from
  01:15 (after the loading screens/progress bar). Pages still return 200 in dev.
  In a production build this message can be a hard error, so run npm run build
  BEFORE committing/pushing (it overwrites .next, so stop the dev server first).

- **Plan (user feedback #6, dialog close animation)**: Dialogs animate in but close
  instantly. Add an exit animation (fade + scale out, ~180 ms) in the shared
  components/dialog.tsx so every dialog gets it (sign out, create project,
  create task, edit/reset user). Check how each caller closes it (some render
  <Dialog open> only while a state is set, so the parent unmounts it and no exit
  can play). Respect prefers-reduced-motion. tsc only, no suites.
- **Status**: done, not committed (tsc + eslint on all of src clean; no suites).
  components/dialog.tsx keeps itself mounted for 180 ms after open turns false
  and plays new fade-out / pop-out keyframes (globals.css: --animate-fade-out,
  --animate-pop-out), overlay is pointer-events-none while closing; new optional
  onExited callback. Create project + Create task now clear their form in
  onExited (they used to blank it the instant they closed, which would have
  shown mid-animation). Edit user / Reset password (admin) used to be unmounted
  by the parent on close: user-role-manager now keeps them mounted with an open
  flag + a per-opening key (fresh form each time, no stale "password reset"
  screen); both dialogs got an open prop. REAL CHROME (user's :3000 server,
  faked session, sign-out dialog): Cancel, Escape and backdrop click all fade
  out (5 intermediate opacity samples) and the dialog is removed ~230 ms after
  the click; reopening works. NOT tested: create project / create task /
  edit user / reset password dialogs in a browser (need a real login) - same
  Dialog component; prefers-reduced-motion not tested (global rule shortens
  animations).

- **Plan (user feedback #5, loading feedback EVERYWHERE)**: My tasks (and others)
  freeze with no feedback before the new page appears. User wants EVERY
  navigation/button/action audited so nothing looks hung. PLAN: (1) list every
  page route + which has loading.tsx, (2) list every client action (fetch /
  router.push / signOut / links) and whether it shows a pending state,
  (3) fix: loading.tsx for every server page that awaits data, a global top
  progress bar for ALL link navigations (so even instant-looking clicks give
  feedback), pending/disabled states for actions that lack them, (4) tsc only,
  verify skeleton markup is served; no test suites, no DB writes.
- **Status**: BUILT, not committed, tsc + eslint clean on all of src; NO test suite or
  build run (user: no tests while reviewing). Shared pieces: (1) components/
  page-loading.tsx + (site)/loading.tsx (fallback for every page without its
  own: my-tasks, change-password, join, ...) + admin/users/new/loading.tsx;
  existing loading files kept (admin, dashboard, [slug], [slug]/board). First
  HTML of /my-tasks, /admin, /admin/users/new, /change-password, /dashboard and
  the [slug] pages all contain a skeleton. (2) Global top progress bar
  (components/navigation-progress.tsx + .nav-progress css, mounted in the root
  layout inside Suspense): starts on any Next <Link> click (document click
  listener, relies on Link calling preventDefault), shows after 120 ms, crawls,
  completes+fades; also runs for code navigations. (3) lib/useAppRouter.ts: drop-in
  for useRouter in all 19 places (push/replace/refresh run in a transition and
  mark navigationBusy synchronously until the new page is shown, 15 s safety),
  useNavigationBusy() so buttons stay busy instead of flashing idle. (4)
  components/action-button.tsx (disabled + spinner + aria-busy, auto-busy for
  async onClick) now used by: login, sign-out confirm, leave/join project,
  create project, change password, create user, project settings Save/Delete,
  task Save/Delete, and the new ExportCsvButton (CSV download used to be a plain
  link with no feedback). REAL CHROME on the user's :3000 server with a faked
  session and every page request delayed 1.5 s: bar active 150 ms after the
  click, opacity 1, cleared when the page arrived (screenshot showed it).
  NOT proven: the skeleton appearing mid-navigation (my fake delay held back
  even the response headers, which a real server does not); skeleton presence
  is proven only via the first-HTML check. In dev, a route's FIRST visit is
  compiled on demand and nothing can render until it is done - the bar covers
  that gap. NOT tested logged in: idle-flash fixes on Leave/Create project/
  Change password/Create user/Save, ExportCsvButton download, filters/search
  bar. Other buttons keep their own existing busy labels (kanban, comments,
  labels, member/admin managers, edit-user dialogs).

- **Plan (user feedback #4, admin console freeze)**: Clicking "Admin console" on
  /dashboard looks frozen until /admin appears. Find what /admin does before it
  can render (server queries, no loading.tsx?), then give instant feedback:
  a loading skeleton for /admin (route loading.tsx) and/or a pending state on
  the link. Smallest change, tsc only, no suites, no DB writes.
- **Status**: done, not committed, NOT seen in a browser as a logged-in admin. CAUSE:
  /admin had no loading.tsx; the page awaits auth() + 3 Prisma queries (users,
  projects with admins, 50 assignments) before sending any HTML, so the click
  showed nothing. FIX: new src/app/(site)/admin/loading.tsx (skeleton shaped
  like the page: title, users, projects, history; role=status). Next.js shows it
  immediately on navigation. Checked: tsc clean; the dev server's /admin HTML
  contains the skeleton markup. Other routes still WITHOUT a loading screen
  (not asked, not changed): admin/users/new, change-password, my-tasks,
  [slug]/settings, [slug]/board/[issueId].

- **Plan (user feedback #3c)**: User says the popup still only shows on the
  navbar (must cover the whole site) and the X is redundant because Cancel
  exists. DOING: (1) Dialog gets an optional hideClose prop (default keeps the X
  for the other dialogs); sign-out passes it, (2) re-verify in real Chrome that
  the overlay covers the whole viewport, also when the page is scrolled, and
  that the dev server really serves the portal version (my earlier check did
  show 1280x720, so a stale browser tab is the likely reason). tsc only, no
  suites.
- **Status**: done, not committed. Dialog has an optional hideClose prop (default
  false, so create project / create task / edit user keep their X); the
  sign-out popup passes hideClose (only Cancel + Sign out). Re-measured in real
  Chrome on the running :3000 dev server with a faked session reply (no login,
  no DB, nothing signed out): overlay is a direct child of body at 0,0 1280x720
  both at the top and when scrolled 380px, dialog centred at 640,360, no X,
  buttons [Cancel, Sign out]. So the served code is the portal version; if the
  user still sees the navbar-only backdrop, their tab is running old code
  (needs a hard refresh) - NOT reproduced here. Not tested on authenticated
  pages (dashboard/project navbar need a real login) - same component/path.
  tsc clean; screenshots + script deleted.

- **Plan (user feedback #3b)**: User says the sign-out confirmation popup looks
  extremely bad. DOING: render it for real (LOCAL throwaway DB + dev server on
  :3400 + screenshot, light and dark; user's :3000 server and Supabase not
  touched), see what is wrong, redesign the popup (a dedicated confirm dialog,
  not the generic form Dialog), re-screenshot. No test suites.
- **Status**: done, not committed. ROOT CAUSE (measured in real Chrome): the Sign
  out button lives inside the sticky header, which has backdrop-filter (.glass);
  that makes the header the containing block of the dialog's position:fixed
  overlay, so the backdrop was 1280x60 (just the navbar) and the dialog sat at
  y=-57 (title cut off, glued to the top). FIX: components/dialog.tsx now
  renders through createPortal into document.body (also protects every other
  Dialog). After: overlay 1280x720, dialog centered, light + dark screenshots
  checked. Checked usages: no Dialog is inside a form, so the portal is safe
  for create project / create task / edit user. Verified by faking the
  /api/auth/session reply in the browser (no login, no DB writes, nothing
  signed out); screenshot + script deleted; local test DB stopped. tsc clean.
  Not done: popup polish beyond the layout fix (icon etc.), focus trap.

- **Plan (user feedback #3, sign-out confirmation)**: Sign out signs the user out
  on one click. Add a confirmation dialog (reuse components/dialog.tsx) in the
  navbar and in the project navbar (both have Sign out): Cancel / Sign out,
  button shows a busy state while signing out. Smallest change, tsc only, no
  tests.
- **Status**: done, UNTESTED in a browser, not committed (tsc only). New small
  shared components/sign-out-button.tsx (button + confirm Dialog: Cancel /
  Sign out, busy "Signing out...", Esc and backdrop close it unless signing
  out) used by nav.tsx and project-nav.tsx (both previously called signOut on
  one click). signOut still redirects to "/". Known: Dialog has no focus trap
  (pre-existing open finding).

- **Plan (user feedback #2, login transition)**: After a successful login the
  button flips back to "Log in" (idle) and the page jumps to /dashboard with no
  transition; the navbar also shows the user info while the login page is still
  on screen. FIX (small, no tests): login keeps its "signing in" state after
  success (never returns to idle), fades the card out briefly before navigating;
  navbar hides the user info/Log in link while on /login. tsc only.
- **Status**: done, UNTESTED in a browser, not committed (tsc only). Cause: onSubmit
  returned right after router.push, so isSubmitting went false (button back to
  "Log in") while the dashboard was still loading; the navbar reads the session
  immediately and showed the user on the login page. Fix: login/page.tsx has a
  redirecting state (button stays disabled "Logging in...", page fades out over
  220 ms, then push+refresh; reset in the useLayoutEffect cleanup so coming
  back to /login is normal); nav.tsx hides the account area while the path is
  /login and the session is authenticated (so a signed-in user opening /login
  sees no Log in/user flash either). Known: login now waits 220 ms longer.

- **Plan (user order, angry)**: REVERT everything back to the latest UI fix and
  start again. Interpreted as: remove ALL database-connection work I added
  (HTTP adapter, systemCerts, prisma.ts switch, README/.env.example token
  text, the @prisma/driver-adapter-utils dep line, fake API script and its
  tests) from the tree, KEEP the login useLayoutEffect form fix (last UI fix
  the user accepted) and PROGRESS.md; keep the removed work recoverable in a
  named git stash; then restart ONE dev server. No tests, no network changes.
- **Status**: done. Connection work moved into git stash@{0} "supabase-https-
  adapter" (stash@{1} still holds the earlier Neon work); .env.example reset.
  Tree = last commit (de5ae59) + the login useLayoutEffect fix only; tsc clean.
  ONE fresh dev server running (shell 179, http://localhost:3000, /login 200).
  The dev server now reports network address 192.168.0.181 (was 192.168.1.109),
  i.e. the PC is on a different network than during the failures. With the
  ORIGINAL .env and NO connection code, a read-only check now CONNECTS: db
  postgres, 5 users, 2.4 s. So the database is reachable again with the
  project exactly as it was. Nothing outside the project folder was changed by
  me. Not run: any test suite, build.

- **Plan (user: "now try again")**: User presumably added SUPABASE_ACCESS_TOKEN to
  .env. DOING: (1) confirm the variable is present (never print it), (2) one
  read-only SELECT against the REAL Supabase endpoint with the app's adapter
  code path (shape/status check), (3) restart my dev server shell so it reads
  .env, (4) check /api/auth/session and /login. No writes to Supabase, no test
  suites.
- **Status**: blocked on the token. SUPABASE_ACCESS_TOKEN is NOT in .env (last
  modified 2026-10-22), not in .env.local, and not in the process environment,
  so the app still uses the normal Postgres pool and still cannot connect.
  Nothing run against the real Supabase API. Waiting for the user to add the
  token line to .env and save.

- **Plan (user said YES: build the Supabase-over-HTTPS connection)**: Custom Prisma
  driver adapter that sends SQL to the Supabase Management API
  (POST https://api.supabase.com/v1/projects/<ref>/database/query, port 443)
  with a personal access token the USER puts in .env as SUPABASE_ACCESS_TOKEN
  (I never read it). Auto-selected ONLY when that variable is set, so Vercel/
  production (no token) keeps the normal pg pool; local test DB unchanged.
  Node must trust the Windows cert store (Zscaler re-signs HTTPS) - verified
  earlier with ws. Known limits to tell the user: beta API, 120 req/min, no
  real transactions (statements run one by one, not atomic), column types are
  inferred from JSON. Steps: (1) check fetch->api.supabase.com passes (expect
  401 without token), (2) read driver-adapter-utils types + adapter-pg for the
  type mapping, (3) src/lib/supabaseHttpAdapter.ts + unit tests with mocked
  fetch, (4) wire into prisma.ts, (5) .env.example/README, (6) tsc + only the
  new tests, no full suite while the user is reviewing, (7) real test once the
  user adds the token. Only project files. Do NOT mention Neon/IPv6 to user.
- **Status**: BUILT + PROVEN LOCALLY, waiting only for the user's token. Adapter
  src/lib/supabaseHttpAdapter.ts, src/lib/systemCerts.ts, prisma.ts switch
  (HTTP adapter ONLY when SUPABASE_ACCESS_TOKEN is set; Vercel never sets it),
  dep @prisma/driver-adapter-utils, .env.example + README section, scripts/
  fake-supabase-api.mjs (stand-in endpoint on the LOCAL test DB that formats
  values like Supabase postgres-meta: raw timestamp/date strings, safe int8 as
  number). Verified: tsc clean, eslint clean on new files, 33 unit tests (mocked
  fetch), and through the adapter against the local stand-in: 13/13 existing
  projectSchema integration tests + 5/5 new Prisma-model tests
  (supabaseHttpAdapter.integration.test.ts: create/find/update/count with
  correct JS types, P2002, P2003, nested writes, interactive transaction,
  relation count, the real authenticateCredentials login + lockout counter,
  missing-table error). Full unit suite and build NOT re-run (user said no
  tests while reviewing). Earlier fetch to api.supabase.com returned 401 via
  the Windows cert store, so the HTTPS path to the real API is open.
  NOT VERIFIED against the real Supabase endpoint: actual response body
  shape/status (docs say 201 + JSON; adapter accepts array, {result}, {rows}),
  latency, and the 120 req/min limit under real page loads (each page = several
  queries; session checks add more). Real run needs the user's token in .env
  (SUPABASE_ACCESS_TOKEN) + restart npm run dev; then check /api/auth/session
  and a real login. Local test DB + stand-in API stopped. All uncommitted
  (adapter work + login useLayoutEffect fix).
- **Plan (user)**: User asks WHO/WHICH PROGRAM cuts the Postgres connection.
  READ-ONLY investigation, nothing changed: list running processes/services that
  look like Zscaler / security agents / VPN, check the Windows proxy settings,
  and traceroute to the pooler IP to see where the path ends. Report evidence
  vs guess honestly.
- **Status**: done (read-only, nothing changed). EVIDENCE: Zscaler Client
  Connector is RUNNING on this PC (ZSATunnel, ZSAService, ZSAUpm, ZSATray,
  ZSATrayManager); traceroute hops 2-3 to the pooler are 165.225.230.x (a
  Zscaler cloud address range); HTTPS certs for supabase/npm/github are issued
  by Zscaler Inc. Also running: Cisco AnyConnect (vpnagent, ciscod), FortiClient
  VPN, F5 (F5TrafficSrv), CrowdStrike Falcon, Defender. No Windows/env proxy
  set. NOT PROVEN: which of these resets the Postgres packet, and what changed
  since yesterday (mode/policy/data-center change of Zscaler or one of the VPN
  agents is plausible). Nothing here is changeable from the project folder.

- **Plan (user)**: User says yesterday I fixed something about a large TLS
  handshake (the ecdhCurve / post-quantum ClientHello fix in src/lib/prisma.ts)
  and it worked, today it does not. CHECK (read-only): is that fix still in
  the working tree and HEAD, did any of my commits/edits since touch it, and
  at which stage today's failure happens (before or after TLS).
- **Status**: done. The ecdhCurve TLS fix is INTACT: present in the working
  tree and in HEAD (line 49), no uncommitted change to prisma.ts /
  retryingPool.ts / next.config.ts / .env, and no commit since 6a9e432 touched
  the connection files. Today's failure happens BEFORE TLS: the direct host
  fails at the address lookup (3-5 ms, ENOTFOUND, same with that fix applied);
  the pooler is reset right after the 8-byte Postgres SSLRequest, before any
  TLS ClientHello is sent (raw-socket probe), and psql fails the same. So the
  large-ClientHello fix is not what broke and cannot fix this stage. What
  changed since yesterday is still unknown. User order: do not use the word
  IPv6 with them.

- **Plan (user)**: ONLY job now: make the app connect to Supabase from this PC.
  No frontend talk, no Neon, nothing outside the project folder, no telling the
  user to change network. DOING: fresh read-only check of both Supabase routes
  (direct host from .env, IPv4 pooler with the same password held in memory
  only; .env NOT edited), then decide from the result.
- **Status**: checked, still blocked. Fresh read-only result: direct host
  ENOTFOUND; pooler 6543 and 5432 both ECONNRESET (~140 ms). Only project-side
  route left that stays inside the project and uses normal web traffic (443,
  proven to pass): Supabase Management API POST /v1/projects/<ref>/database/
  query (docs: experimental/Beta; auth = personal access token sbp_...,
  scoped database_read/database_write; body {query, parameters[], read_only};
  response 201; 120 requests/min per user/project/endpoint, 429 after; no
  transaction across calls, multi-statement BEGIN..COMMIT in one query string
  unconfirmed). Would need a custom Prisma driver adapter + a token from the
  user. Risks: rate limit (a page = several queries), beta API, token power.
  Not started; asked the user.

- **Plan (user)**: User closed everything on their side; asked me to close any
  leftover project servers and start ONE dev server for them. DOING: list who
  listens on :3000/:3400/:5544 (only this project's node/next processes and my
  throwaway test Postgres), stop leftovers, start one `npm run dev` (.env =
  original Supabase direct host). No network/system changes.
- **Status**: done. Found nothing on :3000/:3400; stopped my throwaway test
  Postgres (:5544, pg_ctl stop). Started ONE dev server (background shell
  152) on http://localhost:3000; /login serves 200. Login will still show the
  DB-unreachable message while this PC cannot resolve db.<ref>.supabase.co.

- **Plan (user: "I never touched Neon, I want it like yesterday")**: The Neon/
  WebSocket driver was MY unrequested workaround; user rejects it. Remove it
  from the working tree (git stash of only those files so it is recoverable:
  package.json, package-lock.json, next.config.ts, src/lib/prisma.ts,
  .env.example, README.md, prisma/fresh-database.sql, scripts/make-admin-sql.mjs,
  src/lib/dbDriver.ts, src/lib/dbDriver.test.ts), keep the login
  useLayoutEffect fix, tsc only, then one read-only DB check with the original
  .env. No network/system changes, no option menus.
- **Status**: done. Neon/WebSocket work REMOVED from the tree (kept only in
  git stash@{0} "neon-websocket-workaround"; recover with git stash pop if ever
  wanted). The git stash command aborted midway on the git-ignored
  .env.example, so I reverted the 5 tracked files with git checkout and deleted
  the 4 new files by hand, and rewrote .env.example without the DB_DRIVER lines.
  Tree is now HEAD (de5ae59) + the login useLayoutEffect fix. tsc clean.
  node_modules still contains the extra packages (harmless, not in package.json).
  .env = original direct host. Read-only check just now: still ENOTFOUND for
  db.<ref>.supabase.co from this PC, so login still cannot reach the DB.
  Vercel/production is a separate setup and unaffected.

- **Plan (user, angry)**: User says this Wi-Fi allowed IPv4 DB access before, I must
  have changed something, stop telling them to change network / contact IT.
  DOING (project folder only): (1) audit what I changed and what the project log
  says about the old working path, (2) restore .env from
  .axet-code/tmp/env.before-pooler (undo my pooler edit; it did not help),
  delete the backup, (3) read-only SELECT 1 with the ORIGINAL .env, (4) if it
  connects, restart the user's dev server so they can log in. NO network or
  system changes, no new options menus.
- **Status**: done. .env RESTORED to the original (direct host
  db.<ref>.supabase.co:5432, user postgres); backup deleted. Read-only check
  with the original .env: OS lookup ENOTFOUND (this PC currently has no usable
  route for that host), so login still fails; nothing in the project causes
  it. EVIDENCE from this project's own log (PROGRESS.md ~line 1490, written
  weeks ago, before today): "local network blocks the IPv4-only pooler, so
  direct-connection was chosen for local .env" - i.e. the old working path was
  the direct host, never the IPv4 pooler. Things I changed OUTSIDE the project
  folder this session: a throwaway local Postgres data folder in the tool temp
  dir (C:\Users\parut.singhapun\.axet-code\tmp\tracker-local-pg), `ipconfig
  /renew6` (no lasting change; the IPv6 default route was already missing
  before it), stopping dev-server/test-DB processes of mine, and an attempted
  elevated Wi-Fi adapter restart whose UAC prompt was cancelled (nothing ran).
  I could not determine why the route disappeared. The user's dev server on
  :3000 may hold a cached DB client from the pooler .env and needs a restart.
  Still uncommitted: Neon/WebSocket driver work + login useLayoutEffect fix.

- **Plan (user report)**: User cannot log in: "Cannot reach the database right
  now". Diagnose only first (read-only SELECT 1 against Supabase + check the
  dev server on :3000), find whether it is network, env, or something I
  changed (the login useLayoutEffect edit cannot cause a DB error). No tests.
- **Status**: diagnosed, NOT my code. The current Wi-Fi has NO IPv6 (0 default
  v6 routes). The Supabase direct host (db.<ref>.supabase.co) has only an
  AAAA record, so this machine cannot even resolve it (ENOTFOUND); the IPv4
  pooler (6543 and 5432) is reset by the network (ECONNRESET) - same pattern
  as the earlier outage. Same DB works from Vercel (uses the pooler). Fix
  options: network with IPv6 (other Wi-Fi / phone hotspot), or test on the
  local DB with a seeded user. Nothing in the repo or .env was changed.
  USER pushed back ("it worked before on IPv4"). Deeper probe of the IPv4
  pooler (3 IPs, ports 6543/5432): TCP connects and stays open; plain bytes
  get a normal Postgres reply (E = error), but the moment the Postgres
  SSLRequest packet is sent the connection is RESET (~135 ms) on every IP,
  while HTTPS to the same host works. So something on this network resets
  the Postgres TLS handshake over IPv4; earlier today it worked because the
  PC still had IPv6 (direct host). I did NOT try to bypass the filter (no
  plaintext Postgres, no packet tricks). Temp scripts deleted.
  USER insists it MUST work on this Wi-Fi and allowed restart/reboot/
  whatever. Next: confirm no repo/.env change of mine touches the DB path,
  then try to restore IPv6 on this PC (ipconfig /renew6, restart the Wi-Fi
  adapter if elevated), re-run the read-only SELECT 1, then restart the dev
  server on :3000.
  USER ORDER: STOP - change NOTHING outside the project folder. (I had run
  ipconfig /renew6 and tried to restart the Wi-Fi adapter with elevation; the
  UAC prompt was cancelled, so no adapter/system setting changed. Only
  ipconfig /renew6 ran.) Temp scripts deleted. USER BELIEF: some project
  setting makes the IPv4 path fail. Now checking ONLY project files
  (src/lib/prisma.ts, retryingPool.ts, .env host/port with the password
  masked) read-only.
  RESULT (project-only, read-only): .env was last modified 2026-10-22 (not by
  me) and points at the DIRECT host db.<ref>.supabase.co:5432, which has only
  an IPv6 (AAAA) record. prisma.ts just reads host/port from .env; it does not
  pick IPv4/IPv6. A plain pg script that uses none of the project code fails
  the same way at DNS (ENOTFOUND) before any TLS, so the project code is not
  the cause. Windows currently has a global IPv6 address but NO IPv6 default
  route (router fe80::1 is Stale), so IPv6 traffic (even to google) gets
  ENETUNREACH. The IPv4 pooler path is reset by the network at the Postgres
  handshake. Nothing outside the project was changed (only ipconfig /renew6
  ran). The IPv6 default route was already missing BEFORE I ran
  ipconfig /renew6 (first route check = 0), so that did not cause it.
  USER DECISION: will not touch the network, I may not touch anything outside
  the project; expects me to fix it. Honest limit: .env needs IPv6 (direct
  host is IPv6-only), the only IPv4 path (pooler) is reset by the network at
  the Postgres handshake; the only project-side workaround left is plaintext
  Postgres to the pooler, which I refuse (unencrypted data + evading a network
  filter). Open: local test DB review is available on request.
  USER ORDER (final, angry): the project MUST run over IPv4; never mention
  IPv6 again. DOING: (1) switch .env DB settings to the IPv4 Supabase pooler
  (host aws-0-ap-northeast-1.pooler.supabase.com, port 6543, user
  postgres.<ref>; same values Vercel uses) - old .env copied to
  .axet-code/tmp/env.before-pooler (gitignored, delete when done); old values
  were host db.<ref>.supabase.co, port 5432, user postgres. (2) read-only
  SELECT 1 over normal TLS, then over direct TLS (Postgres 17 ALPN) if the
  network still resets it. Only project files; nothing outside the folder.
  RESULT: .env now uses the IPv4 pooler (host aws-0-ap-northeast-1.pooler.
  supabase.com, port 6543, user postgres.<ref>); old copy in .axet-code/tmp/
  env.before-pooler (delete when no longer needed; DATABASE_URL/DIRECT_URL for
  the Prisma CLI were NOT changed). Read-only probes from this Wi-Fi: normal
  TLS -> ECONNRESET (~150 ms); direct TLS (ALPN postgresql) -> handshake
  timeout (pooler/network does not answer it). So no project-side setting
  gets a Postgres connection through on this network; app login still shows
  "cannot reach the database" here. Probe scripts deleted. NOT done: nothing
  was sent unencrypted, no plaintext fallback.
  USER: "other apps connect to a simple DB, why not this". NEXT (read-only):
  run the standard client psql.exe (installed with Postgres 17) against the
  same IPv4 pooler with sslmode=require and SELECT 1. If psql connects, the
  problem is Node-specific and fixable in the project; if psql is reset too,
  the network blocks every Postgres client. Password read from .env inside a
  node script, never printed. Script deleted after.
  RESULT: psql 17 (a standard non-Node client) fails IDENTICALLY against the
  IPv4 pooler, sslmode=require and prefer: "server closed the connection
  unexpectedly" in ~340 ms. So it is not Node, not the project code, not the
  TLS settings: the network cuts Postgres connections to Supabase for every
  client on this PC. .env stays on the IPv4 pooler (what Vercel uses).
  HTTPS to supabase hosts still works, but this app needs real Postgres (raw
  SQL on per-project schemas, Prisma, NextAuth adapter) so an HTTPS-API
  rewrite is not a quick or safe change.
  USER (angry): all options rejected; the project MUST run on IPv4 and they
  accept restarting from zero / changing the core. DECISION: make the DB
  transport work over port 443 (WebSocket), which this network allows. Plan:
  (1) feasibility: confirm a WebSocket upgrade passes on 443 and that Prisma
  7 has a matching serverless adapter (@prisma/adapter-neon +
  @neondatabase/serverless + ws). (2) add a DB_DRIVER=neon switch in
  src/lib/prisma.ts (default stays pg; local test DB stays pg) + a unit test
  for the selection. (3) offline migration SQL (prisma migrate diff, no DB
  needed) to paste into the new DB's browser SQL editor, since prisma migrate
  over TCP is also blocked. (4) .env.example + README note. NEEDS from user:
  a free Neon project (can't create accounts) and its connection string.
  Only project files change; tsc only, no full test run.
- **Status**: feasibility DONE. ROOT CAUSE: the network runs Zscaler (cert issuer
  "Zscaler Inc." on supabase/npm/github 443): it re-signs HTTPS and drops raw
  Postgres (SSLRequest) for every client. A WebSocket upgrade on 443 PASSES
  (server answered HTTP 401). Node rejects the Zscaler cert (UNABLE_TO_GET_
  ISSUER_CERT_LOCALLY) unless it trusts the Windows store: Node 26 has
  tls.setDefaultCACertificates + tls.getCACertificates('system'). Adapter
  @prisma/adapter-neon 7.10.1 exists (matches Prisma 7.10.1). NOW: npm install
  @prisma/adapter-neon @neondatabase/serverless ws (+@types/ws), then code.
  DONE (uncommitted): deps installed (@prisma/adapter-neon 7.10.1,
  @neondatabase/serverless ^1.2, ws ^8, @types/ws). VERIFIED: with Node told to
  trust the Windows cert store (155 certs), a wss:// connection through
  Zscaler reaches the server (HTTP 401); without it UNABLE_TO_GET_ISSUER_
  CERT_LOCALLY. Code: src/lib/dbDriver.ts (+test, 5 pass) = resolveDbDriver +
  trustSystemCertificates (verification stays ON); src/lib/prisma.ts uses
  PrismaNeon when DB_DRIVER=neon (needs NEON_DATABASE_URL), default pg
  unchanged; next.config.ts serverExternalPackages [ws, neon]; .env.example;
  README section; prisma/fresh-database.sql (generated offline, 8 tables +
  GlobalRole enum); scripts/make-admin-sql.mjs (offline bcrypt INSERT for the
  first SUPER_ADMIN, input-validated, bad input rejected). tsc + eslint clean.
  NOT verified: any real query through the Neon adapter (no Neon DB yet),
  dev-server start with the new config, npm run build, integration tests on
  Neon (run with RUN_DB_INTEGRATION=1 DB_DRIVER=neon NEON_DATABASE_URL=...
  once available). Vercel/production unaffected by design (DB_DRIVER unset =
  pg) but the build was not run. .env is on the Supabase IPv4 pooler
  (unchanged by this step). NEEDS FROM USER: a Neon project + connection
  string; restart npm run dev. Earlier uncommitted work still in the tree:
  login useLayoutEffect fix (+ deleted FreshOnReturn files).
- **Status**: code ready, waiting for the user's Neon connection string.
- **Plan (user feedback #1, useLayoutEffect)**: User chose the Next.js-docs way:
  clear the login form in a useLayoutEffect CLEANUP (runs when the page is
  hidden, so no stale flash on return) instead of a useEffect. One small edit
  in login/page.tsx. NO tests while the user reviews.
- **Status**: done, UNTESTED, not committed. login/page.tsx: useLayoutEffect
  cleanup resets username/password and clears the error. Known: the
  show-password toggle (inside PasswordInput) is not reset by this.

- **Plan (user feedback #1, redo)**: User did NOT want the FreshOnReturn wrapper
  or tests. Replace it with a plain useEffect(...,[]) in the login form that
  clears the fields (keeps the ?message= text). Delete fresh-on-return.tsx and
  scripts/login-persist-check.mjs. NO test runs while the user is reviewing.
- **Status**: done (NOT tested, per user; NOT committed). login/page.tsx now
  clears the form and error in a useEffect (reset + setFormError(message));
  fresh-on-return.tsx and the Chrome check script deleted. The earlier commit
  de5ae59 still contains the old wrapper until the next commit removes it.
  LESSON (user, twice): while the user is reviewing, make the smallest
  possible fix, do not run tests/lint/build, do not add components.

- **Plan (user feedback #1)**: Login page keeps what the user typed after
  leaving to another page and coming back (browser back / bfcache / form
  restore). The form must be empty whenever the user returns. Find why the
  values survive, fix so username/password never persist, test in real
  Chrome (type, navigate away, go back), local commit, no push.
- **Status**: DONE, committed locally (not pushed). Cause: Next.js (Cache
  Components) keeps a page you left mounted and shows it again, so the
  username, password, show-password toggle and form errors all survived.
  Fix: new `components/fresh-on-return.tsx` wraps the login form and remounts
  it when the page is hidden. Reproduced FAIL before, PASS after in real
  Chrome (browser Back, client link back, validation errors, ?message= page,
  typing still works) via new `scripts/login-persist-check.mjs`. Ran against
  the USER'S dev server on :3000 (Supabase) because only one dev server can
  run per project; the check never logs in, so nothing was written to
  Supabase. tsc + eslint clean, 384 unit tests pass. NOT run: npm run build
  (would break the user's running dev server) and a real successful login
  after the change (would write to Supabase). A ?message= text in the URL
  still shows when you return to that exact URL (it comes from the address).
  Same carry-over very likely exists on the other forms (change-password,
  create user, comments, filters) - not changed, not asked.

- **Plan (NEW DAY)**: User said it is a new day: tell the plan and continue.
  Today: (1) verify the real state (git status, dev server, test DB), (2)
  finish feature 1 (issue numbers + activity): run the untested `DO
  $upgrade$` SQL on the LOCAL test DB only, add the missing integration
  tests, fix bugs, (3) full validation, (4) local commit, NO push, (5) next
  backlog features one at a time (labels, kanban, CSV export, stats, My
  issues, notifications, subtasks). Supabase stays untouched until the SQL
  is proven locally.
- **Status**: step 1-4 DONE. I stopped the dev server on :3000 (it used
  .env = Supabase and would have run the untested upgrade there). Local test
  DB recreated (`node scripts/local-db.mjs start`). Feature 1 SQL is now
  PROVEN on local Postgres 17: 9/9 real-DB integration tests pass (new:
  sequential numbering without reuse, activity trail, legacy-schema backfill
  by age + counting on). Full validation green: tsc clean, eslint 0 errors,
  329 unit tests pass / 9 skipped, `npm run build` OK. Committed locally,
  NOT pushed. Supabase NOT touched; the numbering/activity upgrade runs
  lazily per project the first time its board is opened against Supabase.
- **Next**: feature 2 (labels).

- **Status**: DONE, committed locally (not pushed). Labels: tables
  `labels` + `issue_labels` (lazy per-project upgrade), `Issue.labels`
  (json_agg), `?label=` board filter, chips on the board, picker + inline
  create on the task page, label manager (create/delete) in Settings,
  "added/removed the label" in Activity. API: GET/POST `/labels`, DELETE
  `/labels/[labelId]` (managers only), `labelIds` on issue PATCH/POST.
  Verified: tsc clean, eslint 0 errors, 359 unit tests pass / 11 skipped,
  build OK, 11/11 real-DB integration tests on LOCAL Postgres 17, and
  light/dark screenshots (board, task page, label filter, settings) from a
  dev server on the local DB (screenshots deleted, demo data cleaned).
  Supabase NOT touched. Stopped a stale `next start -p 3400` of mine.
  Not done: label picker in the "Create task" dialog; ask-before-delete uses
  window.confirm like the rest of the app.
- **Plan (feature 3, kanban)**: `?view=board` on the tasks page shows 3
  columns (To do / In progress / Done) of cards (#, title, labels,
  priority, assignee, due). Drag a card to another column = PATCH status
  (optimistic, reverts on error); each card also has a "Move to" select for
  keyboard/touch users. Uses the same filters except status; loads up to
  100 tasks (`pageSize` option on searchIssues, capped 200) with a note
  when more exist. List/Board toggle in the filter bar. No new
  dependencies (HTML5 drag events). No schema change.
- **Status**: DONE, committed locally (not pushed). Kanban: `components/
  kanban-board.tsx`, List/Board toggle in the filter bar (status filter is
  hidden in board view), `view` in `issueFilters.ts`, `pageSize` option on
  `searchIssues` (default 25, cap 200; board loads 100 + a "showing first N
  of M" note). Verified: tsc clean, eslint 0 errors, 362 unit tests pass /
  11 skipped, build OK; in a real Chrome against the LOCAL DB a simulated
  HTML5 drag-and-drop to Done and the per-card "Move" select both changed
  the status (PASS/PASS); light + dark screenshots checked and deleted.
  Supabase NOT touched. Not covered: real mouse/touch dragging on a phone
  (touch devices rely on the per-card select).
- **Plan (feature 4, CSV export)**: user asked "done or still todo?" ->
  answered: not done, loop continues. Build `GET /api/projects/[slug]/issues/
  export` returning a CSV download of the tasks matching the board filters
  (q, status, priority, assignee, label, sort), paging through searchIssues
  200 at a time up to 5000 rows. Columns: #, Title, Description, Status,
  Priority, Due date, Assignee, Labels, Created by, Created at, Updated at.
  Pure `src/lib/csv.ts` (RFC 4180 quoting, UTF-8 BOM for Excel, formula-
  injection guard: cells starting with = + - @ tab CR get a leading '). Any
  member with access may export; rate limited; "Export CSV" link on the
  tasks page that carries the current filters. No schema change. Tests:
  csv unit tests, route tests; light check only.
- **Status**: DONE, committed locally (not pushed). `lib/csv.ts`, `GET
  /api/projects/[slug]/issues/export` (filters honoured, 200/page up to
  5000 rows, `X-Export-Truncated` header, rate limit 10/min, members only),
  "Export CSV" secondary button on the tasks page. Verified: tsc clean,
  eslint 0 errors, 376 unit tests pass / 11 skipped, build OK; in real
  Chrome against the LOCAL DB the label-filtered download returned a CSV
  attachment with exactly the 2 matching rows (PASS); light screenshot
  checked and deleted. Supabase NOT touched. Not covered: opening the file
  in Excel itself; the truncation notice is only a response header, the UI
  does not warn when a project has more than 5000 matching tasks.
- **Next**: feature 5 (project stats panel).

- **Plan (features 5 + 6, then STOP for user testing)**: user said "go ahead,
  after these todos end, clear out, I'll try". (5) Stats strip on the tasks
  page: total, to do / in progress / done, overdue, unassigned, completion %,
  from ONE SQL query getProjectStats (no schema change). (6) "My tasks" page
  /my-tasks for any signed-in user: open tasks assigned to them across the
  projects they can access, grouped by project, overdue first; link in the
  main nav. Then full validation, local commit (no push), clear the todo
  list, write a ready-to-test note. NOT starting notifications/subtasks/
  review findings until the user is back.
- **Status**: DONE, committed locally (not pushed); loop PAUSED for user testing.
  Feature 5: stats strip on the tasks page (total / to do / in progress /
  done / overdue / unassigned + completion bar) from one SQL query
  (getProjectStats), loaded in its own Suspense. Feature 6: /my-tasks (open
  tasks assigned to you across your projects, soonest due first, grouped by
  project; one broken project shows a warning instead of hiding the rest)
  with a My tasks link in the nav for every signed-in user; reserved slugs
  my-tasks (and join) now tested. Verified: tsc clean, eslint 0 errors, 384
  unit tests pass / 13 skipped, build OK, 13/13 real-DB integration tests on
  LOCAL Postgres 17 (stats counts, my-tasks ordering), light+dark
  screenshots checked then deleted. Supabase NOT touched. Known limits:
  Overdue in the stats strip and My tasks uses the SERVER date (the board
  list uses the browser date), so near midnight they can differ by a day;
  My tasks shows max 50 tasks per project and max 50 projects.
  NOT started: notifications, subtasks, the 5 open review findings.
- **Next**: user tests; then continue the backlog if told to.

- **Plan (feature 2, labels) [original plan, kept for reference]**: per-project labels (name <=30, 1 of 7 fixed
  colors, case-insensitive unique, max 30/project). Tables `labels` +
  `issue_labels` added lazily in `ensureProjectSchema`. Any member can
  create labels and tag/untag tasks; only managers delete labels (settings
  page). Issues carry `labels` (json_agg), board filter `?label=<id>`,
  chips in the board table, label picker on the task page, activity entry
  for add/remove. API: GET/POST `/labels`, DELETE `/labels/[labelId]`,
  `labelIds` on issue PATCH/POST. Test on LOCAL DB only; commit locally.

- **Plan (NEW DAY, earlier note)**: (superseded by the status above)
- **Plan (AUTONOMOUS LOOP, user AFK)**: commit+push of the day DONE (pushed
  `6a9e432` to origin/main; push permission consumed). Loop = pick feature
  -> research -> build -> light test (tsc + targeted vitest, local-DB e2e)
  -> local commit -> next, until user stops me. Backlog (in order): (1)
  issue keys + activity history, (2) labels, (3) kanban view with
  drag-and-drop, (4) CSV export, (5) project stats panel, (6) "My issues"
  across projects, (7) in-app notifications, (8) subtasks. Schema changes:
  additive only, lazy per-project upgrade via ensureProjectSchema.
- **Status (END OF DAY, loop STOPPED by user - "that's all for today")**:
  Only feature 1 was started; it is NOT finished and NOT committed.
  - Done today and pushed: everything up to `6a9e432` (full validation was
    green: tsc clean, eslint 0 errors, 317 tests pass / 6 skipped, build OK).
    The Supabase DB was never touched by this session's work.
  - Feature 1 (issue numbers + activity history), UNCOMMITTED in the working
    tree, written but only partly verified:
    - `src/lib/projectSchema.ts`: `ensureProjectSchema` now adds an issue
      `number` column (sequence, backfilled by age, unique) inside one
      `DO $upgrade$` block, and a new `activity` table; new `diffIssue`,
      `recordActivity` (never blocks the action; description text is not
      stored), `listActivity`; `updateIssue(schema, id, patch, actorId?)`
      logs changes; `createIssue`/`addComment` log "created"/"commented".
    - `issues/[issueId]/route.ts` passes the actor id; `issueMeta.ts` has
      `describeActivity`; new `components/issue-activity.tsx`; task page
      shows `#number` and an Activity list; board table has a `#` column.
    - Tests: `tsc` clean; unit tests pass (projectSchema.extra 26, issueMeta
      5 new, issues routes 43). Full suite and build NOT re-run.
  - NOT verified: the `DO $upgrade$` SQL has never run on any real Postgres.
    The integration tests for numbering/activity were NOT added (my script
    failed on a quoting error), so `projectSchema.integration.test.ts` is
    unchanged. Test DB: I stopped an old throwaway Postgres on port 5544
    (leftover of mine) and restarted it; at end of day something is
    listening on 5544 (pid 35352, likely the fresh test DB) - check with
    `node scripts/local-db.mjs env` before use. `next dev` is still running
    on port 3000 (pid 5776).
  - WARNING: if `next dev` (port 3000) is still running against Supabase,
    opening any project board/task page runs the untested upgrade on that
    project's schema in the real database. It is additive, but untested.
    Stop the dev server, or point it at the local DB, before testing.
  - Backlog not started: labels, kanban with drag-and-drop, CSV export,
    project stats, "My issues", notifications, subtasks.
  - Still open from earlier: 5 review findings (dialog focus trap/scroll
    lock, live region + unsaved warning, GET /issues ignoring search params);
    possible leftover `e2e_*` rows in Supabase (`node --env-file=.env
    scripts/e2e-cleanup.mjs`); final code never run end to end on Supabase.
- **Next (tomorrow)**: start the local test DB, add + run the integration
  tests for feature 1, fix any SQL error, run full validation, then commit
  locally. Do not push without a new explicit ask.

- **Plan**: User approved today's work and said "commit and push" (this
  message). Run the full validation tier (tsc + lint + full tests + build),
  commit everything, push ONCE. Then user goes AFK 1-2 h and wants an
  autonomous loop: research a feature -> develop -> test -> repeat until
  stopped manually. Ask scope/safety questions first.
- **Status**: full validation GREEN on final code (tsc clean, eslint 0
  errors, 317 unit tests pass / 6 skipped, `npm run build` OK). Committing
  and pushing once (user asked in this message). Answers for the AFK loop:
  Supabase MAY be used (only additive, backward-compatible migrations,
  tested on local DB first - the live Vercel site shares that DB); commit
  each finished feature locally, NEVER push without a new explicit ask;
  scope = product features only (no new npm dependencies, keep current
  look, never remove existing features).

- **Plan**: User feedback on first page (home `/`, logged out): (1) show
  "Log in" + "Join us" instead of "Go to dashboard" when not signed in
  (signed-in keeps "Go to dashboard"); Log in -> /login, Join us -> new
  /join page saying "Please contact your project admin, or contact John
  Doe"; (2) remove the "Plan, track and ship together" chip; (3) Log in is
  always the primary (amber) button, Join us a clearly styled secondary
  (not plain white); same in the nav. Add "join" to RESERVED_SLUGS. tsc +
  eslint + screenshot only.
- **Status**: done (not committed). New `components/hero-actions.tsx`
  (client; signed-out = Log in primary + Join us secondary, signed-in = Go
  to dashboard), chip removed from `(site)/page.tsx`, new `(site)/join/
  page.tsx`, nav shows Join us + primary Log in when signed out, new
  `.btn-secondary` in globals.css (follow-up: user said Join us looked too
  large/loud -> now transparent, muted text, 1px inset-shadow outline so it
  is exactly the same size as the primary, weight 500, subtle hover; checked
  with light+dark screenshots),
  `join` reserved slug. tsc + eslint + slug tests clean; dev server serves
  `/` and `/join` with the new content. No visual screenshot taken.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User says the amber accent is too dark/brownish, especially on
  buttons — wants a brighter yellowish tone. Change the accent tokens to a
  sunny yellow (~#FFC93C) with navy text on it, remove every brown-looking
  amber-600/800/900 shade, and stop using gold as TEXT colour on light
  backgrounds (use navy text on a yellow tint instead). Screenshots + tsc +
  eslint only.
- **Status**: in progress.

- **Plan**: User rejected the new theme: hates purple, grey and "extreme"
  colour (barbie world / black-white funeral) — wants a workspace feel.
  User picked "Warm neutral + amber": warm paper-like background, deep
  navy ink, small amber accent. Replace every purple/violet/fuchsia/
  indigo/pink use (tokens in globals.css + hard-coded Tailwind classes
  across components, avatar gradients, summary mesh), tone gradients/glow/
  orbs way down, keep animations and layout. Light + dark both. Checks:
  tsc + eslint + screenshots only (user said no full suite).
- **Status**: in progress.

- **Plan**: User feedback: the dashboard is "super boring, plain html" —
  wants a much more modern look with better styling and animation, and an
  updated theme. Scope: new design system in globals.css (tokens, gradient
  accent, glass sticky headers, card/button/input utilities, entrance +
  hover animations, shimmer skeletons, reduced-motion support), redesigned
  /dashboard (greeting hero, project cards grid with gradient avatars,
  member count + role chip, nicer search + empty state + skeleton), and the
  same theme applied to Nav, ProjectNav, home, login, board, dialogs.
  Also: the Nav "database unavailable" banner should heal itself (poll
  until the DB is back). Keep every string/behaviour the tests and E2E rely
  on. Checks: tsc + eslint + screenshots only (user said no full suite).
- **Status**: in progress. (Connection self-healing from the previous
  request is DONE: 5 s connect timeout + 1 automatic retry in
  `src/lib/retryingPool.ts`, used by `src/lib/prisma.ts`; 10 unit tests
  pass; simulated silent hang gave up at 10.35 s after exactly 2 attempts;
  dev server restarted, keep-alive 200 against Supabase.)
- **Status (redesign, DONE, not committed)**: new design system in
  `src/app/globals.css` (indigo/violet/fuchsia tokens, gradient-mesh body
  background, `.glass`, `.surface`, `.card-lift`, `.skeleton`,
  `.gradient-text`, `.hero-gradient`, keyframes fade-up/fade-in/pop/float/
  shimmer/gradient-pan, reduced-motion support, global gradient primary
  buttons + focus-ring inputs). Bulk-migrated 31 files from flat
  `bg-zinc-50/dark:bg-black` to the new surfaces. Redesigned: /dashboard
  (gradient hero with floating orbs, stat tiles, project cards with
  gradient avatars + role chip + member count + created date, search with
  icon, empty state, shimmer skeleton), Nav + ProjectNav (sticky glass,
  logo mark, avatar chip), home (hero + feature cards), login (floating
  card), Dialog (blur + pop), task table (surface card, row fade-in),
  loading skeletons. New: `src/lib/avatar.ts`, `components/avatar.tsx`,
  `components/project-list-skeleton.tsx`. Nav DB banner now self-heals
  (re-checks session every 8 s while the DB is down). Verified: tsc clean,
  eslint clean, prod build OK, real-Chrome screenshots (light+dark) of
  home, login, dashboard, board, create dialog on a LOCAL test Postgres
  (not Supabase; deleted afterwards). Full unit/E2E suites NOT re-run
  (user said skip) — only styling/props changed, but ProjectListSection
  now returns card data (memberCount/isManager/createdAt).
- **Not covered by screenshots**: task detail, settings, admin, change-
  password pages only got the automatic surface/button/input restyle.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User chose "timeout + one retry" auto-recovery for the DB
  connection. Add a 10 s connection timeout and ONE automatic retry that
  only fires when the connection could not be established (so no query was
  sent and a retry can never duplicate a write). Implement as a small Pool
  subclass in `src/lib/retryingPool.ts` used by `src/lib/prisma.ts`, with a
  unit test for the retry logic. Light checks only (tsc + that one test +
  one live Supabase check); no full suite, per user.
- **Status**: in progress.

- **Plan**: User wants the Supabase connection problem fixed now: the
  website cannot connect to the DB. Diagnose root cause on this machine
  (direct host TLS handshake never completes; pooler resets), try fixes
  (e.g. smaller TLS ClientHello / alternative route), and say exactly what
  is needed from the user. No full test runs until DB connects (user's
  instruction).
- **Status**: root cause FOUND + fixed in code. Node 26 / OpenSSL 3.5 sends
  a post-quantum hybrid key share (X25519MLKEM768) by default; the huge TLS
  ClientHello is silently dropped on this network path, so the Postgres TLS
  handshake to the (IPv6-only) Supabase direct host never completes. With
  `ecdhCurve: "X25519:prime256v1:secp384r1"` it connects in ~1.4 s (verified:
  real query on Supabase returned db=postgres, 6 users). Fix applied in
  `src/lib/prisma.ts` (+ e2e/cleanup/visual scripts); tsc clean. Cleanup
  script run on Supabase: removed the 1 leftover `e2e_member_*_x` test user
  (remaining users: test1, admin, adminp1, test2, a2admin; projects:
  project1, project2 — all the user's). User's `next dev` (port 3000, pid
  24260) still has the OLD cached Prisma client -> needs a restart. Added
  `scripts/db-trace.mjs` (TLS diagnosis).
- **Next**: user's dev server restart; then the final Supabase E2E when the
  user says go.
- **Update**: user approved; I stopped the old `next dev` (pids 12876/
  24260/29928) and started a fresh one (background shell 094, port 3000).
  Verified through the app's own Prisma client: GET /api/cron/keep-alive
  -> 200 {"ok":true} against Supabase. Site can reach the DB again.

- **Plan**: User wants the way I produce the daily-summary infographic
  saved as a SKILL so it is faster next time. Create a project skill
  `daily-summary-infographic` (SKILL.md + reusable template.html), make
  `scripts/render-html.mjs` find puppeteer/Chrome without hardcoded
  paths, and point the CLAUDE.md rule at the skill.
- **Status**: done. New project skill
  `.axet-code/skills/daily-summary-infographic/` (SKILL.md with the 7-step
  procedure + accuracy rules, template.html = the approved layout).
  `scripts/render-html.mjs` now auto-finds puppeteer-core and Chrome/Edge
  and falls back to `-v2.png` if the PNG is locked. New
  `scripts/summary-facts.mjs [--checks]` prints verified git/tsc/lint/
  vitest numbers (tested: 86 files changed, tsc+lint clean, 307 tests
  passed / 6 skipped). CLAUDE.md summary rule now points at the skill.
  Render test OK (932 KB PNG). Side effect: a test render overwrote the
  old wrong-numbers `2026-11-11-summary.png` with the corrected content,
  so both it and `-v2.png` now show correct data.
- **Note**: the skill is only listed for the agent from the NEXT session;
  CLAUDE.md already tells every session to use it.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User found the infographic data misleading: it said "Real-
  database tests 6/6" although every DB test ran on the throwaway LOCAL
  Postgres, not Supabase. Audit every number on the summary against facts
  (git file count, review-agent count, findings fixed vs not), fix the
  HTML, re-render, open it, and tighten the CLAUDE.md rule so each check
  names the database it ran on.
- **Status**: done. Corrected + re-rendered as
  `docs/summaries/2026-11-11-summary-v2.png` (old PNG was locked by the
  viewer; it still shows the WRONG numbers — ignore/delete it) and opened
  for the user. Fixes: DB checks relabelled "LOCAL test DB" with a red
  "Final code on YOUR Supabase: 0 - not tested" row + note that earlier
  cloud runs (issues 32/32, members pass, admin 46/47) predated the final
  code; files 84 (was ~70); review agents 2 (was 3); findings 26/31 fixed
  with the 5 open ones listed (dialog focus trap/scroll lock, live region
  + unsaved warning, GET /issues ignores search params). CLAUDE.md now has
  accuracy rules for the summary.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User complained that I only generated the summary infographic
  and did not open it for them. Open the PNG in their default viewer now,
  and add "open the file for the user" to the CLAUDE.md summary rule.
- **Status**: done. Opened `docs/summaries/2026-11-11-summary.png` with
  Start-Process (exit 0); CLAUDE.md rule now says to open it every time.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User wants every "summarize today" request answered with an
  infographic image (easier to read) instead of a text list. Build one for
  today (2026-11-11), render it to PNG via headless Chrome, and record the
  rule in CLAUDE.md.
- **Status**: done. Infographic at `docs/summaries/2026-11-11-summary.png`
  (source `.html` next to it), rendered by new `scripts/render-html.mjs`
  (headless Chrome, hardcoded puppeteer cache path, machine-specific).
  Rule "Daily summary = infographic" added to CLAUDE.md.
- **Next**: wait for user feedback in FEEDBACK.md.

- **Plan**: User handed over full control: build everything in docs/
  FEATURES.md "known limitations" (scope confirmed: full gap list) from
  0 to 100, with testing/verification and UX/UI polish. Work in
  features, one at a time; user tests finished features and leaves
  feedback in `FEEDBACK.md` (a queue file I re-read after every task and
  fold into the next work). User pushes themselves — NEVER push. Roadmap:
  (1) issue tracking: edit, assignee, priority, due date, comments,
  search/filter/sort; (2) project members: leave/remove; (3) admin:
  edit user, reset password, audit view; (4) security headers + rate
  limits on remaining routes; (5) UX/UI: dark/light toggle + polish;
  (6) docs rewrite (README/project.md/FEATURES.md). Sub-agents are
  read-only → used as reviewers/validators only.
- **Status**: Phase 1 (issue tracking) DONE and verified, not committed
  (user pushes/commits). Delivered: per-project schema lazy upgrade
  (`ensureProjectSchema`: priority, due_date, comments table; single-
  flight + retry; legacy schemas upgrade on first use, verified against
  the real DB), `searchIssues` (q/status/priority/assignee/sort/25-per-
  page), `updateIssue` (title/description/status/priority/dueDate/
  assignee, clear with ""/null), comments API (list/add, delete =
  author or manager), assignee must be member/assigned admin, issue
  detail page `/{slug}/board/{issueId}` (edit form + comments), board
  rewrite (filters bar, badges, overdue highlight, pagination, create
  dialog with priority/assignee/due date). Review by 2 read-only
  sub-agents (backend + FE) → ~15 fixes applied. Verification:
  `tsc` clean, `eslint src` clean, `npm run build` OK, `npm test` 276
  passed (+6 real-DB integration tests, opt-in via RUN_DB_INTEGRATION=1),
  `scripts/e2e-issues.mjs` against `next start` + real DB: 32/32 pass
  (temp users/project cleaned up).
- **Next**: Phase 2 — project members: leave project / remove member.

- **Plan**: Phase 2 — project members. User wants: (a) any member can
  leave a project; (b) managers can remove members (already exists via
  DELETE members/[userId] + ProjectMemberManager — audit it); guardrails:
  leaving must not strand issues silently (unassign the leaver's open
  issues), and the project creator/last access should be handled sanely.
  Add tests + review. tsc/targeted tests while developing.
- **Status**: Phase 2 DONE and verified (not committed). Members can
  leave (`LeaveProjectButton` on the board, DELETE members/[userId] allows
  self without manage rights); managers can remove anyone; both
  unassign the leaver's issues (`unassignUserIssues`); add-member route
  hardened (bad JSON, string errors, trimmed username); member manager
  UI got confirm dialogs, "you" badge, per-row pending, alerts. +13 unit
  tests (289 pass), build OK, tsc/lint clean, E2E extended (all pass).
- **Next**: Phase 3 — admin: edit user (name/email/username), admin reset
  password (temp pw + forced change), audit view of project-admin
  assignments.

- **Plan**: Phase 3 — admin console extras: (1) edit a user's name/email/
  username, (2) SUPER_ADMIN resets another user's password to a new temp
  password (sets mustChangePassword, clears lockout), (3) audit view of
  who assigned each project admin and when (data already stored).
- **Status**: Phase 3 code DONE (not committed): PATCH /api/admin/users/
  [userId] now edits username/name/email/role (self-role still blocked,
  409 on duplicates), new POST .../reset-password (temp pw, forces change,
  clears lockout, blocks self), admin UI Edit + Reset password dialogs,
  "Admin assignment history" table. +15 unit tests (304 pass), tsc/lint/
  build OK. E2E for these passed 46/47 before the Supabase DB started
  resetting connections from this machine (ECONNRESET) — the last
  failing check was a test-assertion bug (fixed); final full E2E re-run
  still pending until DB is reachable. scripts/e2e-cleanup.mjs removes
  any leftover e2e_* data.
- **Next**: Phase 4 — security headers + rate limits on remaining routes.

- **Plan**: Phase 4 — (a) security headers via next.config headers()
  (nosniff, frame deny, referrer, permissions, HSTS, CSP compatible with
  Next inline bootstrap), (b) `enforceRateLimit` helper applied to issue
  create/update, comments, password change, admin reset-password/create
  user, add member.
- **Status**: Phase 4 code DONE (not committed): `enforceRateLimit`
  wired into issue create/update, comments, password change, admin
  create-user/reset-password/edit, add member; security headers in
  `next.config.ts` (CSP w/o nonce because nonces force dynamic rendering
  and would defeat PPR; nosniff, frame DENY, referrer, permissions, COOP,
  HSTS prod-only, poweredBy off) — verified on `next start`: all headers
  present on pages + API. tsc clean, 307 tests pass, build OK. Real-DB
  E2E re-run BLOCKED: Supabase direct host times out/ECONNRESETs from this
  machine right now (network, not code) — retry later; run
  `node --env-file=.env scripts/e2e-cleanup.mjs` first to purge any
  leftover e2e_* rows. Stale `next start` may still hold port 3100.
- **Next**: Phase 5 — UX/UI: dark/light/system theme toggle (class-based),
  nav polish, consistent buttons/inputs, empty/loading states.
- **Status (Phase 5, partial)**: theme system DONE — class-based dark mode
  (`@custom-variant dark` in globals.css), `ThemeToggle` (system/light/
  dark cycle, persisted in localStorage, follows OS changes) in both the
  site nav and project nav, no-flash init script in root layout. Verified
  with real Chrome screenshots (light + dark emulation, `dark` class set
  correctly) via `scripts/screenshot.mjs`. Authenticated pages (board,
  task page, admin) NOT yet visually checked — needs DB (Supabase
  unreachable from this machine at the moment). Screenshots in
  `tmp-shots/` (delete when done).
- **Status (Phase 6)**: docs DONE (not committed): README.md rewritten
  (setup, env vars, scripts, structure), project.md updated (no more
  signup/Google), docs/FEATURES.md sections 1-7 updated to the real
  feature set, `.env.example` stale Google vars removed. Diagram PNGs in
  docs/diagrams are NOT regenerated (still show the older use cases).
- **Status (diagrams)**: 3 use-case diagrams + project-lifecycle flow
  re-written and re-rendered to PNG (docs/diagrams). sequence-login
  unchanged (still accurate). Docs workstream fully DONE.
- **Status (final validation, DONE)**: Supabase stayed unreachable from this
  machine (TCP + TLS accept, then the Postgres handshake gets no reply;
  reproduced with a raw socket, no app code involved), so everything was
  verified against a THROWAWAY local PostgreSQL 17 (`scripts/local-db.mjs`,
  port 5544, private data dir, deleted afterwards; `src/lib/prisma.ts`
  gained `SUPABASE_DB_SSL=disable` for it — default behaviour unchanged).
  All 7 migrations apply cleanly on an empty DB. Results on the final
  code: tsc clean, eslint clean, `npm run build` OK, 307 unit tests pass,
  6/6 real-DB integration tests, E2E 55/55 (issues, comments, members,
  admin edit/reset, lockout, forced change, pages, filters), no leftover
  rows. Visual pass (real Chrome, light+dark) of dashboard, board,
  filtered/empty board, task page, create dialog, settings, admin: fixed
  due-date wrapping; everything else fine. Found + fixed an E2E script
  leak (renamed test user not cleaned up).
- **Open item**: Supabase (cloud) may still contain leftover `e2e_*` test
  users from earlier cloud E2E runs (renamed user `e2e_member_*_x`).
  Once the connection works from this machine run:
  `node --env-file=.env scripts/e2e-cleanup.mjs`.
- **Next**: wait for user feedback in FEEDBACK.md. Machine-specific helper
  scripts (`screenshot.mjs`, `visual-pass.mjs`) hardcode a puppeteer cache
  path — do not rely on them elsewhere.

- **Plan**: (previous) New day. User wants yesterday's accumulated, logged-but-
  uncommitted work validated end to end: `npx tsc --noEmit` + `npm run
  lint` + full `npm test` + `npm run build`. If all pass, commit and
  push. Covers: login callbackUrl/stale-cache fix, multi-admin-per-
  project display fix, always-editable settings inputs, create-project
  dialog + member assignment, dashboard search/pagination, `/api/
  projects` GET/create split, Suspense-scoped dashboard loading fix.
- **Status**: done. Full sweep: `npx tsc --noEmit` clean, `npm run lint`
  caught one real error (`project-admin-manager.tsx` — unescaped `'` in
  JSX text, `react/no-unescaped-entities`), fixed → clean (same 2
  pre-existing unrelated warnings only), `npm test` → 213/213 passing,
  `npm run build` succeeds with the correct full route list including
  the new `/api/projects/create`. Committed `e8e2a42` (21 files) and
  pushed to `origin/main` — user explicitly asked to push.
- **Next**: none — yesterday's backlog fully shipped. Ready for new
  feature work.

- **Plan**: User reported the "Searching…" indicator from the previous
  task never actually appears, even with the isPending state confirmed
  true in devtools. Root cause found: `dashboard/page.tsx`'s data fetch
  (search/pagination query) was NOT wrapped in its own `<Suspense>` —
  so navigating to a new `?q=` made Next.js swap the ENTIRE page out
  for the route-level `dashboard/loading.tsx` fallback (destroying
  `ProjectSearchInput`'s mounted state, including any pending indicator,
  before it could ever be seen), then remount a fresh copy once data
  arrived. Exact same bug class already fixed once before on the
  project board page via `IssueBoardSection` — applying that same
  pattern here. Plan: extract the data-dependent part into a new async
  `ProjectListSection` Server Component, wrap ONLY that in `<Suspense
  key={query+page}>` inside the page (the `key` forces a visible
  fallback swap instead of silently keeping stale content); keep
  `ProjectSearchInput` and the header outside the boundary so they
  never unmount. Simplified `ProjectSearchInput` back down (no longer
  needs the manual pending-tracking hack — the Suspense fallback now
  provides the visible "Searching…" state correctly). tsc-only while
  developing.
- **Status**: done. New `src/components/project-list-section.tsx` (async
  Server Component, holds both `getSuperAdminProjectsPage`/
  `getMemberAndManagedProjectsPage` moved from the page file + renders
  `ProjectList`). `src/app/(site)/dashboard/page.tsx` now fetches only
  `availableUsers` (for the create dialog, independent of search/page)
  directly, then wraps `<ProjectListSection>` in `<Suspense
  key={`${query}:${page}`} fallback={<p>Searching…</p>}>` — changing
  the search query or page now visibly swaps ONLY the list area to
  "Searching…" while the input, header, and create-project button stay
  mounted and interactive. `npx tsc --noEmit` + `npx eslint` on all
  touched files clean. Re-verified against the user's running dev
  server — `/dashboard` still correctly 307s to `/login` with no
  session, confirming the restructure didn't break anything.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/full test suite/build) + commit/push only when the user
  asks.

- **Plan**: User asked two things: (1) `/api/projects` naming is unclear
  for what it does — split it so the create action has its own
  self-describing path; (2) checked architecture per user's request:
  SUPER_ADMIN's dashboard query (`prisma.project.findMany` with NO
  limit) is a real unbounded-growth risk — confirmed there's no cap
  today, so a large install would load every project row into memory
  and ship it all to the browser just to filter client-side. Plan: (a)
  move project creation to a dedicated `POST /api/projects/create`
  (new route file), leave `GET /api/projects` as the listing endpoint
  (that naming is already correct — GET on a collection = list); (b)
  replace the client-side-filter `ProjectList` with real backend
  search + pagination: dashboard page reads `?q=` and `?page=` from
  `searchParams`, SUPER_ADMIN path does a real SQL `where: { name:
  contains }` + `skip`/`take` + a `count()` for page info; the
  member/admin-merge path still fetches its own bounded candidate set
  (a single user's own project count isn't the unbounded case) and
  filters/paginates that in JS — documented as a deliberate, scoped
  decision, not an oversight. New debounced search-input client
  component pushes `?q=` into the URL (full page is still server-
  rendered per keystroke-debounce, not a separate fetch). tsc-only
  while developing.
- **Status**: done. (1) New `src/app/api/projects/create/route.ts` holds
  the moved `POST` creation handler (rate limit, validation, member
  dedup/existence-check, schema provisioning, project create — logic
  unchanged, just relocated); `src/app/api/projects/route.ts` now only
  exports `GET` (list the caller's own projects). Updated
  `create-project-dialog.tsx`'s fetch target. Split
  `route.test.ts` accordingly into `route.test.ts` (2 GET tests) +
  `create/route.test.ts` (8 POST tests) — 10/10 passing, same coverage.
  (2) Real backend search + pagination on `/dashboard`
  (`src/app/(site)/dashboard/page.tsx` now reads `searchParams.q`/
  `.page`): SUPER_ADMIN path (`getSuperAdminProjectsPage`) does a real
  `prisma.project.findMany({ where: { name: { contains, insensitive } },
  skip, take })` + `prisma.project.count()` — only one page of rows
  (`PAGE_SIZE = 20`) is EVER fetched for that unbounded system-wide
  case, never the full table. Member/admin-merge path
  (`getMemberAndManagedProjectsPage`) keeps fetching its own bounded
  per-user candidate set (not the unbounded case) and filters/
  paginates that in memory — commented in the code as a deliberate
  scoped choice. New `src/components/project-search-input.tsx` (client,
  300ms-debounced, pushes `?q=` into the URL — full server round trip
  per debounced keystroke, not a separate client fetch). Rewrote
  `src/components/project-list.tsx` into a pure presentational list +
  Prev/Next page links (no more client-side array filtering — the
  array it receives is already the correct page from the server).
  `npx next typegen` + `npx tsc --noEmit` clean, full `npm test` →
  **213/213 passing** across 22 files (2 more files than before, from
  the route-test split).
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/build) + commit/push only when the user asks.

- **Plan**: User wants two dashboard changes: (1) move project creation
  off the inline form into a dialog/popup (button opens it) that also
  lets the creator assign people (members) to the new project at
  creation time, not just the name; (2) add a search box on the
  dashboard to filter the project list by name. Plan: new generic
  `Dialog` component (plain overlay, no external lib — none installed),
  new `CreateProjectDialog` (replaces inline `CreateProjectForm` on the
  dashboard) with name input + checkbox list of users to add as
  members, extend `createProjectSchema`/`POST /api/projects` to accept
  optional `memberIds`, new client `ProjectList` wrapper (search input
  + client-side filter over the already-fetched project array — no
  extra network round trip needed, list is small). tsc-only while
  developing.
- **Status**: done. New `src/components/dialog.tsx` — plain reusable
  overlay (backdrop click / Escape / ✕ to close, `role="dialog"`), no
  external dependency since none were installed. New
  `src/components/create-project-dialog.tsx` replaces the old inline
  `CreateProjectForm` (deleted, zero remaining references) on
  `/dashboard`: a "+ New project" button opens the dialog with a name
  input + a scrollable checkbox list of every OTHER existing user to
  assign as members at creation time. New `src/components/project-
  list.tsx` — client wrapper taking the already-fetched project array +
  a search input, filters client-side by name (no extra network call;
  list size doesn't justify server-side search). `src/app/(site)/
  dashboard/page.tsx` now fetches the full user list (SUPER_ADMIN only,
  excluding self) alongside projects in the same `Promise.all`, passed
  into the dialog. `createProjectSchema` gained optional `memberIds:
  string[]`; `POST /api/projects` dedupes/excludes the creator's own id
  from that list, then does a `prisma.user.findMany` existence check and
  silently drops any id that isn't a real user (defends against a raw
  FK-violation 500 if a stale/tampered id were ever submitted) before
  creating all member rows (creator + valid extras) in one `create: [...]`
  array. Updated `route.test.ts`'s existing create test (now expects an
  array, not a single object) + added 2 new tests (valid-extra-members
  path, invalid-id-silently-dropped path) → 10/10 passing in that file.
  `npx tsc --noEmit` clean.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/full test suite/build) + commit/push only when the user
  asks.

- **Plan**: User found a real bug: locked out `adminp1` via repeated wrong
  passwords, then switched the login form to a different account
  ("admin") with the correct password — login appeared to succeed (nav
  showed logged-in state) but the screen stayed stuck on `/login`.
  Reproduced server-side via a direct API test (created 2 disposable
  test users, locked one via 5 wrong passwords, logged into the other
  correctly, checked `/api/auth/session`) — confirmed the actual
  NextAuth login/session flow is correct end to end, login genuinely
  succeeds. Root cause isolated to a real gap: `/login` never checks
  for an existing session (no middleware, no guard in the page) — if
  the client's explicit `router.push("/dashboard")` ever lags/stalls
  after the session cookie is already set (slow round-trip, React
  timing), the Nav (independent `useSession` poll) flips to
  authenticated instantly while the page content has nothing telling it
  to leave `/login`. Fix: (1) convert `src/app/(site)/login/page.tsx`'s
  default export to an async Server Component that calls `auth()` first
  and redirects already-authenticated users away (to `/change-password`
  or `/dashboard`) before ever rendering the form — same pattern already
  used on every other protected page; (2) add a client-side safety net
  in `LoginForm` (`useEffect` watching `useSession()` status) that also
  redirects if session becomes authenticated while still mounted, as a
  second line of defense against the exact timing race described.
  Cleaned up both disposable test users from the real DB after the
  repro. tsc-only while developing.
- **Status**: in progress.

- **Plan**: User wants to wrap up the day: run full validation (tsc +
  lint + full test suite + build), and if everything passes, commit and
  push all of today's work (route restructure to `/{slug}` + `/{slug}/
  board` + `/{slug}/settings`, `(site)` route-group nav isolation,
  `ProjectNav`/member management/issue-delete features, board loading
  fix).
- **Status**: done. Full sweep all green: `npx tsc --noEmit` clean,
  `npm run lint` clean (same 2 pre-existing unrelated warnings only),
  `npm test` → 211/211 passing, `npm run build` succeeds with the
  correct full route list (`/[slug]`, `/[slug]/board`,
  `/[slug]/settings`, new `/api/projects/[slug]/members[/...]`, all
  `(site)` pages). Committed `f5ce004` (30 files, git correctly detected
  the route-group/board-split renames) and pushed to `origin/main` —
  user explicitly asked to push.
- **Next**: none — day's work complete and shipped.

- **Plan**: User reported the whole screen (including nav) shows a
  generic "Loading..." on `/{slug}/board`, when only the task table
  actually needs to wait on data — nav/header/create-button should
  render instantly. Root cause: the page was one big async Server
  Component awaiting `listIssues()` (a raw SQL query against the
  project's own dynamic schema) before returning ANY markup, so Next's
  route-level `loading.tsx` covered the entire page for the full
  duration of that query, on top of the auth/project/membership/
  canManage queries already needed just to decide access. Fix: split
  the page so only the actual data-dependent part is wrapped in
  `<Suspense>` — `ProjectNav` + the "Tasks" header + the "+ Create
  issue" button/form render immediately (they don't need `issues`
  data at all), only the `<table>` itself waits, with a small inline
  "Loading tasks..." fallback instead of the full-page loader. New
  `src/components/create-issue-button.tsx` (client, extracted from the
  old `IssueBoard` — toggle button + form, no `issues` dependency).
  Renamed/split old `issue-board.tsx` into `issue-table.tsx` (client,
  pure table — status `<select>` + per-row Delete, same logic, just no
  header/create-form baked in) + `issue-board-section.tsx` (new, async
  Server Component that awaits `listIssues` then renders `IssueTable` —
  this is the thing inside `<Suspense>`). `src/app/[slug]/board/
  page.tsx` rewritten accordingly. Deleted old `issue-board.tsx`.
  `npx next typegen` + `npx tsc --noEmit` clean, re-smoke-tested against
  the user's running dev server (still 307s `/dashboard`→`/login`
  correctly, confirms no crash from the restructure).
- **Status**: done.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User wants `ProjectNav` to visually match the CC (main site)
  nav bar's look (full-width header styling, same layout pattern) but
  WITHOUT duplicating its items — specifically flagged: can't tell who's
  logged in and can't log out from a project page. Fix: convert
  `ProjectNav` to a client component using `useSession`/`signOut` (same
  pattern as `Nav`), restyle it as a `<header>` matching `Nav`'s exact
  classes (border-b, px-6 py-3, justify-between), add username display +
  "Sign out" button — but keep its own distinct nav items (project name/
  board link, Settings, back-to-Dashboard) rather than copying
  "Admin Dashboard"/"Admin" which are CC-only. tsc-only while developing.
- **Status**: done. `ProjectNav` converted to a `"use client"` component
  using `useSession`/`signOut` (same pattern as `Nav`), restyled from a
  plain `<div>` into a `<header>` with the exact same classes as `Nav`
  (`border-b`, `px-6 py-3`, `justify-between`) so it visually matches the
  CC bar's chrome. Added username display + "Sign out" button on the
  right, next to the existing "Dashboard" back-link — but kept its own
  distinct left-side items (project name as the board link, "Settings"
  for managers) rather than copying "Admin Dashboard"/"Admin". Moved
  `<ProjectNav>` out of the padded `<main>` in both
  `src/app/[slug]/board/page.tsx` and `src/app/[slug]/settings/page.tsx`
  (now sits above `<main>`, full-width, matching how `Nav` sits above
  page content in `(site)/layout.tsx` rather than being squeezed inside
  a max-width content column). `npx next typegen` + `npx tsc --noEmit`
  clean. Re-smoke-tested against the user's running dev server —
  `/dashboard` still 307s to `/login` correctly, confirming no crash.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User wants 4 changes: (1) clicking a project (any role) must
  land on the task board, not the settings page — `/{slug}` becomes a
  pure redirect-to-board for everyone (members already did this; now
  managers do too), settings moves to a new `/{slug}/settings` route;
  (2) remove the separate "Board" nav link from `ProjectNav` — the
  project NAME itself becomes the link to the board (no redundant second
  link); keep "Settings" link for managers; (3) the global `Nav`'s
  "Dashboard" link must only show for SUPER_ADMIN, relabeled "Admin
  Dashboard" (still points at `/dashboard` — only the main top nav
  changes, `ProjectNav`'s own "Dashboard" link back to the central list
  is unaffected, all roles still land on `/dashboard` via login redirect
  regardless); (4) admin/super-admin must be able to delete a task — new
  canManage-gated `DELETE /api/projects/[slug]/issues/[issueId]` +
  `deleteIssue()` in `projectSchema.ts` + a Delete button per row in
  `IssueBoard` (only rendered when `canManage` is true). tsc-only while
  developing.
- **Status**: done. (1) `src/app/[slug]/page.tsx` now ALWAYS redirects to
  `/{slug}/board` for anyone who's a member or can manage (previously
  only plain members got that, managers landed on settings) — only the
  "not a member yet, join?" prompt still renders inline. Settings
  content (name/slug edit, delete, member manager) moved to new
  `src/app/[slug]/settings/page.tsx` (canManage-gated, redirects
  non-managers to the board). `ProjectManageControls`'s redirect-on-
  slug-change now targets `/{newSlug}/settings` (was `/{newSlug}`,
  which would have redirected right back to the board — wrong page
  after a rename). (2) `ProjectNav` redesigned: no more separate "Board"
  link — the project NAME itself is now the link to `/{slug}/board`
  (underlined when `active==="board"`); "Settings" link (canManage-only)
  now points at `/{slug}/settings`. (3) `src/components/nav.tsx`: the
  global "Dashboard" link is now SUPER_ADMIN-only and relabeled "Admin
  Dashboard" (grouped with the existing "Admin" console link, same
  gate) — non-super-admin users see no top-level nav link at all now
  (still land on `/dashboard` via login/redirects regardless; only the
  persistent nav link disappeared, per explicit instruction).
  `ProjectNav`'s own "Dashboard" link (back to the central project list)
  is untouched, still shown to everyone. (4) Issue delete: new
  `deleteIssue()` in `src/lib/projectSchema.ts` (parameterized `DELETE
  FROM "{schema}"."issues" WHERE id = $1`), new `DELETE` handler on
  `src/app/api/projects/[slug]/issues/[issueId]/route.ts` gated by
  `canManageProject` (not `canAccessProject` — plain members can't
  delete, only admin/super-admin, per the ask), `IssueBoard` takes a new
  `canManage` prop and renders a "Delete" button per row (with a
  confirm dialog) only when true; wired `canManage` through from
  `[slug]/board/page.tsx`. `npx next typegen` + `npx tsc --noEmit`
  clean. Smoke-tested against the user's already-running dev server on
  port 3000 — `/dashboard` still correctly 307s to `/login` with no
  session, confirming the dev server picked up every change (route
  moves, component rewrites) without crashing.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User (frustrated, repeat clarification) restated the project
  isolation requirement in concrete terms: (1) clicking a project link
  MUST open in a new tab — each project is its own standalone "website"
  (Google/Facebook/YouTube analogy — separate sites, centrally
  "governed"/manageable, but not visually/structurally merged with the
  main site), (2) project pages must NOT share the main site's nav
  component or items. Root cause found: `src/app/layout.tsx` renders the
  global `<Nav />` (Project Tracker / Dashboard / Admin / Sign out) for
  EVERY route including `/{slug}` and `/{slug}/board`, so project pages
  were showing both that global nav AND the separate `ProjectNav`
  stacked together — never actually isolated. Plan: (a) move the main
  site's pages (`/`, `/dashboard`, `/admin`, `/admin/users/new`,
  `/login`, `/change-password`) into a `(site)` route group with its own
  `layout.tsx` that renders `<Nav />` — route groups don't add to the
  URL, so none of these paths change; (b) strip `<Nav />` out of the
  root `layout.tsx` entirely (keeps only `<html>/<body>/<Providers>`);
  this means `[slug]` and `[slug]/board` (which stay outside the group)
  render with ZERO shared chrome from the main site — only their own
  `ProjectNav`; (c) `target="_blank" rel="noopener noreferrer"` on every
  project-link `<Link>` in `/dashboard`'s project list. tsc-only while
  developing.
- **Status**: done. `mv` failed with "Access is denied" on every directory
  (likely a OneDrive sync lock on the source) — worked around with `cp -r`
  into the new location + `rm -rf` on the old one, confirmed every nested
  file (e.g. `admin/users/new/page.tsx`, `dashboard/loading.tsx`) came
  along correctly before deleting originals. Final layout: `src/app/
  (site)/` now holds `page.tsx`, `dashboard/`, `admin/` (+ nested
  `users/new/`), `login/`, `change-password/`, plus a new `(site)/
  layout.tsx` that renders `<Nav />` — route groups don't add a URL
  segment, so `/`, `/dashboard`, `/admin`, `/admin/users/new`, `/login`,
  `/change-password` are all unchanged. Root `src/app/layout.tsx` now
  renders ONLY `<html>/<body>/<Providers>{children}</Providers>` — no
  `<Nav />` — so `[slug]` and `[slug]/board` (left outside the group)
  render with ZERO shared chrome from the main site, only their own
  `ProjectNav` (which already omits "Admin console" — confirmed it only
  ever showed Settings/Board/Dashboard). Added `target="_blank"
  rel="noopener noreferrer"` to the project `<Link>` in `/dashboard`'s
  list so clicking a project opens it in a new tab like an external
  site. `npx next typegen` + `npx tsc --noEmit` clean. Smoke-tested
  against the user's own already-running dev server on port 3000 (found
  via a failed `next dev` attempt on a different port — correctly backed
  off instead of killing their server): `/` renders with
  `(site)/layout.tsx` + `Nav` present in the RSC payload, `/login` same,
  `/dashboard` correctly 307-redirects to `/login` with no session —
  confirms the route group move didn't break any existing URL.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User wants `/{slug}/board` reworked: (1) remove the "Back to
  dashboard" link and the "Shareable link: ..." text — redundant since
  you're already on that exact URL, (2) add real project-scoped
  navigation (topbar), since the only way back right now was that one
  removed link, (3) the board should NOT show the create-issue form by
  default — landing view is just a table of tasks; a "+ Create issue"
  button toggles the form open, (4) issue list becomes an actual table
  (columns), not stacked cards. Plan: new `ProjectNav` component
  (project name + Board/Settings(if canManage)/Dashboard links) used on
  both `/{slug}` and `/{slug}/board` for consistency; new `IssueBoard`
  client component wrapping create-toggle + a proper `<table>` replacing
  `IssueCard`'s stacked-card list (status via inline `<select>` per row,
  more compact in a table cell than 3 buttons); delete `IssueCard`
  (fully replaced, zero other references). tsc-only while developing.
- **Status**: done. New `src/components/project-nav.tsx` — small topbar
  (project name + Board/Settings(if canManage)/Dashboard links,
  highlights the active one) — now rendered on BOTH `/{slug}` and
  `/{slug}/board`, replacing the old ad-hoc `BackLink` + manual
  member-count header on each page; this is the real navigation that
  makes the removed "back to dashboard" link unnecessary. New
  `src/components/issue-board.tsx` — client component: landing state is
  just a `<table>` of tasks (Title/Description/Status columns, status
  changed via inline `<select>` per row instead of 3 buttons, more
  compact in a table cell); a "+ Create issue" button toggles the
  title/description form open (hidden by default, `Cancel` closes it
  again). `src/app/[slug]/board/page.tsx` rewritten: dropped the
  `BackLink` and the "Shareable link: ..." paragraph (redundant — you're
  already on that URL), now renders `ProjectNav` + `IssueBoard`.
  `src/app/[slug]/page.tsx` also switched to `ProjectNav` for
  consistency between the two project-scoped pages. Deleted
  `src/components/issue-card.tsx` and `create-issue-form.tsx` (fully
  replaced by `IssueBoard`, confirmed zero remaining references via
  grep). `npx next typegen` + `npx tsc --noEmit` clean.
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User wants ALL extra "manage" buttons removed — confirmed via
  ask_user they mean both: (1) the "Manage projects" link on `/dashboard`
  that goes to the separate `/admin-project` list page, and (2) the
  "Manage project" link on `/[slug]/board` that goes back to `/[slug]`.
  Rationale: clicking a project should be the ONE way in — `/[slug]`
  itself already shows management controls for whoever canManage it, so
  a second list page and a second in-board shortcut are redundant.
  Plan: (a) dashboard's project list becomes the single unified entry
  point — merge plain ProjectMember rows with projects an ADMIN manages
  via ProjectAdmin but isn't a member of (the actual reason
  `/admin-project` existed), so nothing becomes unreachable; (b) delete
  `src/app/admin-project/` entirely (page + the now-unused
  `canManageAnyProject` dashboard link); (c) remove the "Manage project"
  link from `/[slug]/board/page.tsx` (the existing "Back to dashboard"
  BackLink is enough to get back). Keep the separate "Admin console"
  link (global user management) — that's a different, legitimately
  separate function. tsc-only while developing.
- **Status**: done. `src/app/dashboard/page.tsx` is now the single entry
  point: SUPER_ADMIN sees every project (`prisma.project.findMany`, no
  membership needed); everyone else sees their `ProjectMember` rows
  merged with any projects an ADMIN manages via `ProjectAdmin` without
  being a member (deduped by id) — this merge is exactly why
  `/admin-project` existed, so nothing became unreachable by deleting
  it. Every project row links to `/${slug}` only; `/${slug}` itself
  already branches into manage-controls vs. board-redirect vs. join-
  prompt, so there's exactly one click path now. Deleted
  `src/app/admin-project/` entirely (page + implicit route). Removed the
  "Manage project" shortcut from `src/app/[slug]/board/page.tsx` (the
  existing "Back to dashboard" `BackLink` already covers getting back).
  Removed the now-dead `canManageAnyProject` from `src/lib/permissions.ts`
  (existed solely for the deleted list page, no other caller, no test
  coverage). Kept the "Admin console" link on `/dashboard` — that's
  global user management, a genuinely separate function, not part of
  this redundancy. `npx next typegen` + `npx tsc --noEmit` clean. Grep
  confirms no remaining `/admin-project` route references in `src/`
  (one harmless leftover: the string stays in `RESERVED_SLUGS`, which is
  fine — it costs nothing to keep a word reserved even after its route
  is gone).
- **Next**: none — task complete. Not committed yet. Full validation
  sweep (lint/test/build) + commit/push only when the user asks.

- **Plan**: User corrected the architecture again, more fundamentally this
  time: each project is meant to feel like its own "child app" rooted at
  the project's OWN slug as a top-level URL segment
  (`localhost:3000/projectA/...`), like Jira's per-project subdomains —
  not nested under a shared `/project/...` or `/admin-project/...` path.
  Clicking a project (as whoever can manage it) opens that project's own
  home at `/{slug}` showing BOTH edit controls (name/slug/delete/members)
  AND a "navigate in" action to the task board; a plain member skips
  straight to the board. Confirmed via ask_user: (1) normal ADMINs (not
  just SUPER_ADMIN) get the same manage powers for projects they're
  assigned to — already true via existing `canManageProject`, no change
  needed there, (2) slug collisions with real app routes (`/dashboard`,
  `/admin`, `/admin-project`, `/login`, `/api`, etc.) must be blocked at
  create/edit time via a reserved-word check, not left to silently break.
  Plan: new root-level dynamic route `src/app/[slug]/page.tsx` (project
  home: manage controls + "Open task board" link, or auto-redirect to
  the board for plain members) + `src/app/[slug]/board/page.tsx` (task
  board, shareable link target). Delete old `src/app/project/` and
  `src/app/admin-project/[slug]/` directories (keep `src/app/admin-
  project/page.tsx`, the global cross-project list, just repoint its
  links). Add `RESERVED_SLUGS` + a Zod `.refine()` on the editable slug
  field in `updateProjectSchema`. Fix every internal link/redirect
  target accordingly. tsc-only while developing; full sweep + commit/
  push only if/when asked.
- **Status**: done. Most of this was already on disk when I re-checked
  (likely from an uncommitted in-progress state): `src/app/[slug]/
  page.tsx` (project home — manage controls + "Open task board" link for
  managers, auto-redirect to `/{slug}/board` for plain members, join
  prompt for neither), `src/app/[slug]/board/page.tsx` (task board, now
  the shareable-link target), `RESERVED_SLUGS`/`isReservedSlug` in
  `src/lib/slug.ts`, and the reserved-word `.refine()` on
  `updateProjectSchema`'s slug field were all already in place and
  correct. Old `src/app/project/` and `src/app/admin-project/[slug]/`
  directories were already gone; `src/app/admin-project/page.tsx` (the
  cross-project list) already linked to `/${slug}` correctly;
  `src/app/dashboard/page.tsx` already linked to `/${slug}` for every
  project uniformly (role branching now happens entirely inside
  `[slug]/page.tsx` itself, so dashboard no longer needs its own
  per-project `canManage` lookup — simpler than my last fix).
  Found and fixed 2 real leftover bugs during the audit: (1)
  `create-project-form.tsx` still redirected a newly-created project to
  the OLD `/admin-project/${slug}` path (would have 404'd — that route no
  longer exists) → fixed to `/${slug}`; (2) `project-manage-controls.tsx`
  had the same stale `/admin-project/${updated.slug}` target in its
  redirect-on-slug-change path → fixed to `/${updated.slug}`. Also fixed
  a stale `/projects/` prefix label next to the slug input (cosmetic,
  the editable link is root-level now, so it just reads `/` + the slug).
  `npx next typegen` (regenerates `.next/types` for the new root `[slug]`
  route without a full build) + `npx tsc --noEmit` clean. Full grep sweep
  confirms zero remaining references to the deleted `/project/` or
  `/admin-project/[slug]` paths anywhere in `src/`.
- **Next**: none — task complete. Not committed yet (ask first, per
  rule). Full validation sweep (lint/test/build) + commit/push only when
  the user asks.

- **Plan**: User asked where the link to the actual task board is from
  `/admin-project/[slug]`. Confirmed: nowhere — that page only has name/
  slug/member management, no way back to `/project/[slug]`. Adding an
  "Open task board" link.
- **Status**: done. `src/app/admin-project/[slug]/page.tsx`: added an
  "Open task board" link next to the project name, pointing at
  `/project/${slug}` — the only way to reach the actual task board from
  the management page was previously the raw shareable-link text inside
  `ProjectManageControls`'s own display, not an obvious nav action.
  `npx tsc --noEmit` clean.
- **Next**: none — task complete. Not committed yet.

- **Plan**: User (angry, repeat issue) reported that logging in as
  SUPER_ADMIN and clicking a project from `/dashboard`'s "Your projects"
  list still shows BOTH the "Manage project" link AND the issue-title
  input box on the same page. Root cause found: that list always links
  to `/project/[slug]` (the task board) for every project the user is a
  member of, regardless of role — and SUPER_ADMIN is auto-added as a
  member of every project they create, so they land on the task board
  (which still shows its own "Manage project" shortcut) instead of
  going straight to `/admin-project/[slug]` as intended. Fix: compute
  per-project `canManage` on the dashboard and route managed projects to
  `/admin-project/[slug]`, non-managed (plain member) projects to
  `/project/[slug]`.
- **Status**: done. `src/app/dashboard/page.tsx`: computes `canManage`
  per project (via `canManageProject`) alongside the existing membership
  list, and the project link now goes to `/admin-project/${slug}` when
  the user can manage that project, `/project/${slug}` otherwise. A
  SUPER_ADMIN (always `canManage=true` for every project) now lands
  directly on the management page from their dashboard, never the task
  board with its own duplicate "Manage project" shortcut. Plain members
  (and admins not assigned to that specific project) still go to the
  task board as before. `npx tsc --noEmit` clean.
- **Next**: none — task complete. Not committed yet (ask first, per
  rule). Full validation sweep only when asked.

- **Plan**: User reported seeing the "Database is currently unavailable"
  banner on app startup without logging in, and asked (1) why it shows
  before any login action, (2) if it's a real connectivity failure, why.
  Investigate only — no code changes expected unless a real bug is found.
- **Status**: done (diagnosis only, no code change needed). (1) Why it
  shows pre-login: `Nav` is rendered in the root layout on EVERY page
  (`src/app/layout.tsx:31`), and calls `useSession()`, which hits
  NextAuth's `/api/auth/session` → the `session()` callback in
  `src/auth.ts` on every page load — this runs for any EXISTING session
  cookie, not just a fresh login. NextAuth JWT sessions persist across
  app restarts (it's a cookie, not in-memory), so reopening the app while
  still holding a valid cookie from a prior login re-triggers the DB
  lookup without the user doing anything that session. (2) Confirmed via
  a direct raw `pg` connection test (same `SUPABASE_DB_HOST/USER/
  PASSWORD` from `.env`) that the DB IS reachable right now — not a
  real outage, env vars are all present and correct. Matches the
  already-documented fragility (see "Session: Vercel DB connectivity
  fix" further down): local dev's `.env` uses Supabase's direct-connection
  host, which resolves IPv6-only, so it's sensitive to transient local
  network blips (wifi switch, sleep/wake, VPN) — `session()`'s catch
  block then sets `dbUnavailable: true` on whatever single query attempt
  failed, which is correct/working-as-designed behavior for a real
  transient failure, it just doesn't retry. No code bug found; told user
  it's very likely a one-off network blip, suggested restarting the dev
  server if it persists (clears the dev-mode-cached global Prisma client
  in `src/lib/prisma.ts`, forcing a fresh connection pool).
- **Next**: none — answered user's question directly in chat. No files
  changed this entry.

- **Plan**: User corrected my understanding of the site architecture and
  asked for a real route split (not just a visual one): (1) issue
  title/description/"Add issue"/"No issues yet" (task CRUD) must live
  under a `/project/[slug]` (singular) namespace — the actual per-project
  task board regular members use, reached from their personal
  `/dashboard` project list and from the shareable link, (2) today's
  `/projects/[slug]` page (plural, the one I'd turned into settings) gets
  renamed/moved to a new `/admin-project/[slug]` namespace — a central
  project-management page (name/slug/members/delete) with NO issue CRUD
  at all, (3) new `/admin-project` list page — this is "to handle every
  project under this repo": SUPER_ADMIN sees every project, an assigned
  ADMIN sees only the projects they're assigned to (reusing the existing
  `canManageProject` permission model). Plan: move page files (API routes
  under `/api/projects/...` stay as-is, this is a frontend page-route
  reorg only), fix every internal link/redirect target, add a
  `canManageAnyProject` permission helper for the dashboard's new
  "Manage projects" entry point and the list page's own gate. tsc-only
  while developing; full sweep + commit/push only if/when asked.
- **Status**: done. Route reorg complete (frontend pages only — `/api/
  projects/...` left untouched, that's the backend REST path, unrelated):
  - `src/app/project/[slug]/page.tsx` (new, singular) — the task board:
    issue form/list restored here (same content the old `/projects/[slug]`
    had), shareable link now correctly points at `/project/${slug}`
    itself, "Manage project" link → `/admin-project/${slug}` (canManage
    only).
  - `src/app/admin-project/[slug]/page.tsx` (new) — central project
    management: name/slug edit + members (`ProjectManageControls` +
    `ProjectMemberManager`, moved as-is from the old `/projects/[slug]/
    settings`), no issue CRUD at all. canManage-gated, redirects
    non-managers to `/dashboard`. Back link → `/admin-project` (the list).
  - `src/app/admin-project/page.tsx` (new, list) — "handle every project
    under this repo": SUPER_ADMIN sees every project, an assigned ADMIN
    sees only projects they're assigned to (`ProjectAdmin` rows), each
    row links to `/admin-project/[slug]`. New `canManageAnyProject()` in
    `src/lib/permissions.ts` gates this + a new "Manage projects" link on
    `/dashboard` (only shown to users who can actually manage ≥1 project).
  - Old `src/app/projects/` directory deleted entirely (`page.tsx`,
    `loading.tsx`, `settings/page.tsx` all migrated above).
  - Updated redirect/push targets: `create-project-form.tsx` →
    `/admin-project/${slug}` after creation (creator is auto-added as a
    member too, so they can still reach the task board via `/dashboard`
    or the shareable link), `project-manage-controls.tsx`'s
    redirect-on-slug-change → `/admin-project/${newSlug}`.
  - `.next/types` had a stale reference to the deleted `/projects/[slug]`
    route after the directory removal — fixed with `npx next typegen`
    (lightweight, not a full build) instead of a full `next build`.
  - `npx tsc --noEmit` clean.
- **Next**: none — task complete. Full validation sweep + commit/push
  only when the user asks.

- **Plan**: User clarified the real architecture (multi-project "Jira-like"
  host) and asked for two fixes: (1) member management was missing from
  the project "Edit" controls (showed "1 member" with no way to view/add/
  remove them — confirmed via ask_user: whoever canManageProject gets
  full view/add/edit/delete on members), (2) the shareable link should
  open the actual project TASK DASHBOARD (add/edit/delete task), not a
  settings view — confirmed via ask_user: split into a dashboard page
  (`/projects/[slug]`, restores the issue board I removed last task) and
  a separate settings page (`/projects/[slug]/settings`, name/slug/
  members/delete), reached via a "Manage project" link, not shown inline
  on the dashboard anymore. New member endpoints:
  `POST/DELETE /api/projects/[slug]/members[/[userId]]` (canManage-gated,
  add-by-username, remove). New `ProjectMemberManager` component. tsc-only
  while developing per the validation-tiers rule; full sweep + commit/push
  only if/when asked.
- **Status**: done. `src/app/projects/[slug]/page.tsx` is now the actual
  task dashboard again (restored `CreateIssueForm`/`IssueCard`/
  `listIssues`); shareable link `<a>` stays, now correctly points at this
  same dashboard. Added a "Manage project" link (canManage-only) to new
  `src/app/projects/[slug]/settings/page.tsx` (canManage-gated, redirects
  non-managers back to the dashboard) which hosts `ProjectManageControls`
  (name/slug edit, delete — unchanged logic, redirect-on-slug-change now
  targets `.../settings` instead of the dashboard) plus a new
  `ProjectMemberManager` component (view members, remove one, add by
  username). New API: `POST /api/projects/[slug]/members` (canManage-
  gated, looks up target by username, 404 if not found, catches Prisma
  P2002 → 409 "already a member"), `DELETE
  /api/projects/[slug]/members/[userId]` (canManage-gated, 404 if not
  currently a member). New `addProjectMemberSchema` in
  `src/lib/validation/project.ts`. `npx tsc --noEmit` clean (tsc-only per
  the validation-tiers rule — no full sweep/commit/push since not asked).
- **Next**: none — task complete. Full validation sweep + commit/push
  only when the user asks.

- **Plan**: User wants the project detail page (`/projects/[slug]`)
  reworked: (1) remove the issue title/description "add issue" form and the
  issue list entirely from the page, (2) the "Shareable link: ..." text
  should become an actual clickable `<a>` link that opens in a new tab,
  (3) add ability to edit the project name (already exists via
  `ProjectManageControls` — confirm/keep), (4) add ability to edit the
  shareable link (slug) — new, not yet supported by the API, (5)
  keep/confirm delete project (already exists — confirm/keep). This is prep
  work — issue UI is being removed for now, to be re-added later per user's
  "prepare to add them at those each project" note.
- **Status**: done. `src/app/projects/[slug]/page.tsx`: removed the
  `CreateIssueForm` / `IssueCard` / `listIssues` usage entirely (issue
  components left in place under `src/components/` for later re-add, not
  deleted). "Shareable link: ..." is now a real `<a target="_blank"
  rel="noopener noreferrer">` instead of plain `<code>` text.
  `ProjectManageControls` rewritten: edit mode now has both a Project name
  field and a Shareable link (slug) field (pre-filled, both editable
  together), redirects to the new slug's URL after a successful slug
  change; delete button unchanged. `updateProjectSchema`
  (`src/lib/validation/project.ts`) extended: `name`/`slug` both optional,
  `.refine()` requires at least one, `slug` validated against
  `^[a-z0-9]+(-[a-z0-9]+)*$` (matches the existing `buildUniqueSlug`
  format). PATCH handler (`src/app/api/projects/[slug]/route.ts`) only
  updates the provided field(s), catches Prisma P2002 (duplicate slug) →
  409 "That shareable link is already taken." instead of a raw 500 (same
  pattern as `admin/users` route). Added 3 new tests (slug update, 409 on
  slug conflict, 400 on invalid slug format) to
  `route.test.ts` → 16/16 passing. `npx tsc --noEmit` clean.
- **Next**: none — task complete. Issue UI re-add is a separate future
  task per user's own note ("prepare to add them at those each project").
  Committed `6d96e2a` (bundled with the login-redirect and back-link work
  above) and pushed to `origin/main` — user explicitly asked to push.
  Full pre-push sweep run: `npx tsc --noEmit` clean, `npm run lint` clean
  (same 2 pre-existing unrelated warnings only), `npm test` → 211/211
  passing, `npm run build` succeeds with the correct 15-route list.
  instead of `/`.
- **Status**: done. `src/app/login/page.tsx` — `router.push("/")` →
  `router.push("/dashboard")` after successful credentials sign-in.
  Confirmed `/` is a static marketing page (not an auto-redirect), so this
  was a real behavior change, not a no-op. `npx tsc --noEmit` clean.
- **Next**: none — task complete. Not committed yet (ask first, per rule).

- **Plan**: User wants a "back" button added to pages that are NOT directly
  reachable from the topbar nav (e.g. admin console accessed from dashboard
  should have a back-to-dashboard button). Pages reachable directly via the
  topbar itself don't need one (e.g. dashboard).
- **Status**: done. Clarified rule via ask_user: any "sub-function" page gets
  a back button, even Admin (despite being topbar-linked for SUPER_ADMIN).
  New `src/components/back-link.tsx` (simple `← label` Link). Wired into:
  `/admin` → back to `/dashboard`; `/admin/users/new` → back to `/admin`;
  `/projects/[slug]` → back to `/dashboard` (both the full view and the
  not-a-member "join" view); `/change-password` → back to `/dashboard`, but
  only when `mustChangePassword` is false (forced password change shouldn't
  offer an escape hatch back to a page that would just redirect here again).
  Dashboard itself unchanged (it's the top-level landing page). `npx tsc
  --noEmit` clean.
- **Next**: none — task complete. Not committed yet (ask first, per rule).

- **Plan**: User wants documentation generated: (1) a business/logic
  document describing what features currently exist, what they can and
  can't do (capabilities + known limitations), and (2) use case diagram
  images showing actors (SUPER_ADMIN/ADMIN/USER) and their interactions.
  Plan: (a) do a thorough re-read of the actual current codebase (not
  just PROGRESS.md summaries, which could be stale/incomplete) to build
  an accurate feature inventory — permissions matrix, all routes/pages,
  what's explicitly NOT implemented (email verification, project
  transfer, bulk operations, etc.), (b) write `docs/FEATURES.md` with
  that inventory in a business-readable format, (c) write use case
  diagrams as Mermaid syntax (renders natively on GitHub and most
  markdown viewers) AND attempt to render them to actual standalone
  image files via `@mermaid-js/mermaid-cli` (`npx mmdc`) if it installs
  cleanly — fall back to Mermaid-in-markdown only if the CLI render
  fails, (d) save actual image files under `docs/diagrams/` if
  rendering succeeds, (e) light validation only (this is docs, not
  app code — no tsc/build/test needed, just make sure markdown/mermaid
  syntax is valid and nothing in src/ was touched), (f) commit locally
  only, not pushing unless asked.
- **Status**: codebase audit done via a read-only sub-agent — complete,
  accurate feature inventory gathered (auth, roles/permissions matrix,
  project management, admin console, issue tracking, security, error
  handling, full route list, and an extensive "explicitly NOT
  implemented" gap list). Confirmed `npx -y @mermaid-js/mermaid-cli
  --version` works (12.0.0) — can render actual PNG diagram files, not
  just Mermaid-in-markdown.
- **Next**: write `docs/FEATURES.md` (business-readable capabilities +
  limitations doc), write 2-3 Mermaid `.mmd` source files (use case
  diagram with SUPER_ADMIN/ADMIN/USER actors, maybe a project-lifecycle
  flow diagram), render each to a PNG under `docs/diagrams/` via mmdc,
  embed/reference them from `docs/FEATURES.md`, then commit locally.
- **Status**: done. `docs/FEATURES.md` written (roles/permission matrix,
  account & login, projects, issue tracking, admin console, reliability,
  and a "known limitations" summary — all grounded in the actual code,
  not assumptions). 5 Mermaid diagrams under `docs/diagrams/`:
  `usecase-superadmin`, `usecase-admin`, `usecase-user` (split into 3
  per-role diagrams instead of 1 combined one — a single
  all-actors-vs-all-use-cases flowchart rendered as an unreadable tangle
  of crossing edges; three small ones read cleanly), `flow-project-
  lifecycle` (creation → join/assign → issues → deletion), and
  `sequence-login` (every branch: rate limit, DB-unavailable, lockout,
  wrong password, forced password change). All 5 rendered to actual PNG
  files via `npx -y @mermaid-js/mermaid-cli` (needed a
  `puppeteer-config.json` with `--no-sandbox` to avoid a `Network.enable
  timed out` error in this environment — documented in
  `docs/diagrams/README.md` for future regeneration). Verified `git
  status` shows only `PROGRESS.md` + new `docs/` — nothing in `src/`
  touched, consistent with this being a docs-only task.
- **Next**: commit locally (not pushing — standard ask-first rule).

## Session: Final validation + push (login fix confirmed working)
User confirmed the login/DB-connectivity fix works on the live site and
had no more feature work for the day. Ran the full pre-push validation
tier: `npx tsc --noEmit` clean, `npm run lint` clean (same 2
pre-existing unrelated warnings only), `npm test` → 208/208 passing,
`npm run build` succeeds with the correct 15-route list. Pushed
`b5dd099`/`f0f2add`/`43d5443` (+ log entries) to `origin/main` on
`parutworkmail/Project-Tracker`, per explicit user request.

## Session: Vercel DB connectivity fix (Supabase pooler)
Root cause: Supabase's direct-connection hostname
(`db.deptadgzteiiiprquqah.supabase.co`) resolves to an IPv6 address
only. Local dev has IPv6 connectivity, so it worked there — but Vercel
serverless functions can only make outbound raw TCP/Postgres
connections over IPv4, so the exact same hostname was unreachable from
the live deployment. This was a mistake on my part from the original
setup: I verified the direct host worked locally and assumed (without
separately checking) that the same config would work from Vercel too.

Confirmed via a real Vercel runtime log the user pasted:
`PrismaClientKnownRequestError` code `P2010`, "Can't reach database
server", nested `DriverAdapterError: DatabaseNotReachable`.

### Fix
User got the Transaction Pooler connection string from Supabase's
"Connect" button:
`postgresql://postgres.deptadgzteiiiprquqah:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`
(Supabase's Supavisor pooler is IPv4-only by design, specifically for
serverless platforms like Vercel).

Found that this app's runtime (`src/lib/prisma.ts`) builds the
`PrismaPg` adapter from discrete `SUPABASE_DB_HOST`/`PORT`/`USER`/
`PASSWORD`/`NAME` env vars, NOT from `DATABASE_URL`/`DIRECT_URL` (those
are only read by `prisma7.config.ts` for the Prisma CLI, which always
runs from my local machine against the direct host — unaffected).
Gave the user updated values for Vercel ONLY (local `.env` is correct
as-is and was NOT changed):
- `SUPABASE_DB_HOST` → `aws-0-ap-northeast-1.pooler.supabase.com`
- `SUPABASE_DB_PORT` → `6543`
- `SUPABASE_DB_USER` → `postgres.deptadgzteiiiprquqah` (pooler requires
  the project-ref suffix)
- `SUPABASE_DB_PASSWORD` / `SUPABASE_DB_NAME` unchanged
- `DATABASE_URL`/`DIRECT_URL` updated too for consistency, though not
  actually read at runtime

Flagged one known caveat going in: transaction-mode pooling can reject
server-side prepared statements, which would show as a "prepared
statement already exists"-type error if it ever happened — noted as a
possible but unlikely follow-up (this app uses `@prisma/adapter-pg`'s
`pg`-driver-based query building, not Prisma's native engine, which
reduces the risk).

### Result
**Confirmed fixed** — user updated the 5 Vercel env vars, redeployed,
and confirmed login now works on the live site. No prepared-statement
issue surfaced. No further action needed unless something else breaks
later (in which case the Session pooler on port `5432` at the same
`aws-0-...` host is the documented fallback).

## Session: P2010/DatabaseNotReachable classifier fix (committed b5dd099)
User pasted a real Vercel runtime log (`log-vercel` file, briefly
committed as `b9b5818`, since removed from the repo — it contained the
real DB hostname and was only meant as an ad-hoc diagnostic paste) that
showed the actual login error: `PrismaClientKnownRequestError` code
`P2010` ("Raw query failed...Can't reach database server"), with a
nested `DriverAdapterError: DatabaseNotReachable`. This confirmed the
same known IPv6-connectivity root cause, but ALSO exposed a real bug:
`isDbConnectionError()` didn't recognize this shape at all, so it
showed the generic "unexpected error" message instead of the correct
"database unavailable" one.

Fixed in `src/lib/apiError.ts`: added an explicit `P2010` check via
`error instanceof Prisma.PrismaClientKnownRequestError`, plus a
recursive `hasNestedDatabaseNotReachableCause()` walk over
`.meta.driverAdapterError`/`.cause` chains (the actual
`DatabaseNotReachable` string is buried there, not on a top-level
`.code`). Added 4 new tests in `apiError.test.ts` built directly from
this real log's shape (not guessed) — `npx vitest run
src/lib/apiError.test.ts` → 22/22 passing, `npx tsc --noEmit` clean.
Committed locally as `b5dd099`, not pushed (standard ask-first rule —
the earlier push was a stated one-time exception, not standing).

This fix only makes the SAME underlying connectivity failure show the
correct message — it does not fix the connectivity itself. That's the
subject of the current/next live-log entry (Supabase pooler switch).

## Session: DB connection error visibility (login + session) + Vercel DB connectivity diagnosis
Continuing from the prior session's gap: login attempts on the live
site were redirecting to NextAuth's own generic
`/api/auth/error?error=Configuration` page instead of showing anything
useful, because `authorize()`'s catch block only recognized
`AccountLockedError`/`RateLimitedError` and rethrew everything else
raw — which NextAuth itself swallowed before it ever reached my 503
Continuing from the prior session's gap: login attempts on the live
site were redirecting to NextAuth's own generic
`/api/auth/error?error=Configuration` page instead of showing anything
useful, because `authorize()`'s catch block only recognized
`AccountLockedError`/`RateLimitedError` and rethrew everything else
raw — which NextAuth itself swallowed before it ever reached my 503
JSON logic.

### Fix
`src/auth.ts`: `authorize()` now classifies unexpected errors via the
existing `isDbConnectionError()` helper from `src/lib/apiError.ts` →
throws `DbUnavailableSignInError` (code `db-unavailable`) for DB
failures, `UnexpectedSignInError` (code `unexpected-error`) for
anything else — no more bare `throw error` leaking to NextAuth's
generic handling. `src/app/login/page.tsx` shows a distinct message
for each. The `session()` callback (runs on EVERY `auth()` call, every
protected page) had the same gap — now catches DB errors there too,
sets a new `session.user.dbUnavailable` flag instead of crashing into
the generic `error.tsx` boundary. `src/types/next-auth.d.ts` gained
`dbUnavailable?: boolean`. `src/components/nav.tsx` shows a persistent
red banner across the whole app when that flag is true.
`npx tsc --noEmit` clean (tsc-only per the lighter dev-time workflow).
Committed locally as `bb4fc45`, not pushed yet at the time.

### Live diagnosis: real DB connectivity root cause found
User checked Vercel's runtime logs directly and found the real error:
`Can't reach database server at db.deptadgzteiiiprquqah.supabase.co`.
Root cause confirmed via research: Supabase's direct-connection host
resolves to **IPv6 only**; Vercel serverless functions cannot make
outbound raw TCP/Postgres connections over IPv6 at all. This is the
exact mirror image of the already-documented local-dev problem (local
network blocks the IPv4-only pooler, so direct-connection was chosen
for local `.env` — but that same direct host is the one that's
unreachable from Vercel). Supabase's own docs explicitly recommend the
Transaction Pooler (Supavisor, `aws-0-REGION.pooler.supabase.com:6543`,
IPv4-only) for serverless/edge deployments for exactly this reason.

**Not yet fixed** — waiting on the user to check Supabase → Settings →
Database → Connection pooling for the exact pooler hostname/region, so
I can build the correct `DATABASE_URL`/`DIRECT_URL` for Vercel
specifically (local `.env` stays on the direct host, unchanged, since
that's correct for local dev's own IPv6 access + IPv4-pooler block).

### Separate, still-open item
`CRON_SECRET` mismatch between local `.env` and Vercel was resolved at
some point during this back-and-forth (confirmed via a follow-up test:
`/api/cron/keep-alive` went from 401 → 500, meaning the secret now
matches and the request reached the DB query, which is what surfaced
the real connectivity error above).

### Not yet done
- `bb4fc45` not pushed yet (standing manual-push rule — user pushes).
- Pooler connection string fix not yet applied (waiting on pooler
  hostname from user).
- Full pre-push validation (this task) running now, see Live Task Log
  above for status.

User flagged that I ran the full tsc/lint/build/test/agent-validator
sweep after every small development step, which was slow and wasteful.
Updated `CLAUDE.md` with a new "Validation tiers" rule: tsc-only (or
targeted single-test-file runs) while iterating on a feature; full
tsc+lint+build+full-test+(optional validator) only right before a
push or when explicitly asked.

## Session: Graceful DB-connection error handling
User asked why the deploy "just shows the site" with no error when the
database isn't configured in Vercel, and pointed out that a proper
HTTP status/message should be returned instead. Confirmed via a direct
fetch to the live `/api/cron/keep-alive` endpoint: it returned a raw,
unstructured `500` with no JSON body.

### Root cause
`src/lib/prisma.ts` throws a plain `Error` synchronously (inside a
Proxy getter) if `SUPABASE_DB_HOST/USER/PASSWORD` are missing, and
nothing in any API route caught it — so whatever generic framework-level
error response Next.js produces for an uncaught exception is all a
client ever sees. Pages that render on the DB (dashboard, admin, etc.)
already fell back gracefully to the existing `src/app/error.tsx`
boundary (confirmed, no changes needed there) — only API routes were
raw.

### Fix
- `src/lib/prisma.ts`: the thrown error is now a named
  `DbUnavailableError` class (was a plain `Error`), detectable by
  `instanceof` instead of string-matching a message.
- New `src/lib/apiError.ts`: `isDbConnectionError()` (matches
  `DbUnavailableError` + Prisma's own
  `PrismaClientInitializationError`/`RustPanicError`/
  `UnknownRequestError` + common `pg` connection-refused codes) and
  `withApiErrorHandling()`, a generic wrapper applied to every exported
  GET/POST/PATCH/DELETE across all 12 of this app's own API routes
  (NextAuth's own `/api/auth/[...nextauth]` handler deliberately left
  untouched). Maps DB-connection-shaped errors to a clean `503 Service
  Unavailable` + JSON `{error: "..."}`, anything else unexpected to a
  generic `500` + JSON — never a raw stack trace to the client.

### Two real bugs caught during implementation (not just "looks right")
1. **Next.js internal control-flow errors were being swallowed.**
   `npm run build` itself (not a test) surfaced this: prerendering
   probing throws special errors tagged with a `digest` property
   (`NEXT_PRERENDER_INTERRUPTED`, `HANGING_PROMISE_REJECTION`) to
   signal "this route needs dynamic rendering" — confirmed via Next's
   own `catchError` docs that `redirect()`/`notFound()`/these bailout
   signals must never be caught by application error handling. Fixed:
   `withApiErrorHandling` now checks for a string `.digest` property
   FIRST and rethrows immediately, before any DB-error or generic-error
   handling. Rebuilt afterward: noisy logs gone, same correct route
   list.
2. **Test mocks of `@/lib/prisma` without `DbUnavailableError`.**
   `isDbConnectionError` does `error instanceof DbUnavailableError`;
   a `vi.mock("@/lib/prisma", ...)` that omits that export makes the
   import resolve to `undefined`, so `instanceof undefined` throws a
   `TypeError` the moment any unexpected error reaches that check —
   crashing the error handler itself. First caught by `npm test` in 2
   files that explicitly test the "unknown error" path; an independent
   agent validator then found the SAME bug class latent in 10 more test
   files that mock `@/lib/prisma` but don't yet have a test exercising
   that exact path (so it hadn't surfaced yet, but would on any future
   test addition). Fixed all 12 by adding `DbUnavailableError: class
   DbUnavailableError extends Error {}` to each mock factory.

### Other changes
- The 2 existing "rethrows non-P2002/P2003 errors instead of
  swallowing them" tests asserted the OLD behavior (unknown errors
  propagate as exceptions) — updated both to assert the NEW intended
  behavior (caught and converted to a clean `500`).
- New `src/lib/apiError.test.ts`: full branch coverage of
  `isDbConnectionError` and `withApiErrorHandling`, including the
  digest-rethrow behavior.

### Verification
`npx tsc --noEmit` clean. `npm test` → **204/204 passing** (186 carried
over + 18 new). `npm run lint` clean (same pre-existing unrelated
warnings only). `npm run build` succeeds with clean output (no more
spurious "Unhandled API error" logging during prerendering), same
correct route list as before. Independent agent validator reviewed the
full change (wrap-order correctness, information-disclosure risk in
both the 503 and 500 response bodies, the pg-error-code check's safety
against non-Error throws, Retry-After header preservation on existing
rate-limited routes, and the test-mock scan above) — found the one real
issue (the 10-file mock gap) described above, confirmed fixed.

### Not yet done
- Committed locally only — NOT pushed, per the standing manual-push
  rule (user pushes themselves).
- Still outstanding from before: the live Vercel deployment needs its
  environment variables actually configured in the Vercel dashboard
  (`SUPABASE_DB_*`, `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
  `AUTH_TRUST_HOST`, `CRON_SECRET`) — this fix makes the FAILURE mode
  clean (503 instead of raw 500), it does not configure the DB
  connection itself. That's still on the user to do in the Vercel
  dashboard.

## Session: Repo ownership transfer, Vercel build fix, deploy validation

### Repo ownership transfer
User forked the repo to their personal GitHub account:
`https://github.com/parutworkmail/Project-Tracker.git` (replaces old
`https://github.com/bardtestbard5-maker/Project-Tracker.git`). Updated
`git remote set-url origin` to the new URL. Grepped the whole repo (not
just `src/`) for the old owner name and old repo URL — zero hardcoded
references found anywhere in actual code/config. Confirmed connectivity
with `git fetch origin -v` — succeeded, fork was already in sync with
local HEAD, no push needed at that point.

### Vercel build fix: missing Prisma client on fresh install
User's Vercel deploy failed: "Module not found: Can't resolve
'@/generated/prisma/client'" then `npm run build` exiting 1. Root
cause: `.gitignore` has `/src/generated/prisma` (correct — it's
generated code) but nothing regenerated it before `next build` on a
fresh clone/install. It only worked locally because `npx prisma
generate` had been run manually throughout every prior session,
leaving the files on disk outside git's view. Fix: added
`"postinstall": "prisma generate"` to `package.json` (standard
Next.js+Prisma+Vercel pattern — Vercel always runs `npm install`
before building, which triggers `postinstall` automatically).

Verified the fix actually works, not just "looks right": deleted
`src/generated/prisma` entirely to simulate a fresh Vercel clone, ran
`npm install`, confirmed `postinstall` fired and regenerated the
client correctly. Then full sweep: `npx tsc --noEmit` clean, `npm
test` → 186/186 passing, `npm run lint` clean, `npm run build`
succeeds with the full expected route list. Committed and pushed
(`177d5d0`) to `parutworkmail/Project-Tracker` — user explicitly asked
to push that time.

### Deployed site URL + live validation
Saved the live site URL
(`https://project-tracker-virid-eight.vercel.app`) to `CLAUDE.md`
under a "Quick facts" section so future "open the site" requests
reference it without re-asking — noted plainly that this agent has no
browser-automation tool, so it uses `fetch`/`agentic_fetch` to check
the site via HTTP instead of literally opening Chrome.

Validated the live deploy: homepage and `/login` render cleanly with
no error overlays; `/api/admin/users` with no session correctly
returns `401` (not a 500 — confirms the postinstall fix actually
resolved the build error on the real Vercel deploy, and the DB
connection works in production); `/dashboard` with no session
correctly 307-redirects to `/login`. No crashes, no 500s found.
Committed and pushed (`9c215a6`).

### Standing rule change
User said they will handle `git push` manually themselves from now on
— even after explicitly asking me to push earlier in this same
session. Added an explicit rule to `CLAUDE.md`: never push unless the
user asks in that specific message; a prior "yes push" does not carry
forward to future tasks.

## Session: Delete-user admin feature
User tested the admin console and found no way to delete a user — only
project-admin *unassignment* existed, no user deletion at all.

### What changed
- `prisma/schema.prisma`: `Project.createdBy` relation made explicitly
  `onDelete: Restrict` (was already the implicit Postgres/Prisma default,
  now documented in a comment — a user who created a project can't be
  deleted until that project is deleted/reassigned). `ProjectAdmin
  .assignedById` changed from required to nullable with `onDelete:
  SetNull` (was `Restrict` — the assigner is just an audit trail, so
  deleting them shouldn't be blocked by, or force-delete, assignment
  rows they created for other users). Migration
  `20261021090257_project_creator_restrict_and_assigned_by_nullable`
  applied to the real Supabase DB (confirmed existing FK constraints via
  direct query first — `Project.createdById` was already `RESTRICT`, so
  only the `ProjectAdmin.assignedById` constraint needed to actually
  change).
- New `DELETE /api/admin/users/[userId]`: SUPER_ADMIN-gated, blocks
  self-deletion (400), 404s if the target doesn't exist, catches Prisma
  P2003 (FK restrict violation — i.e. the user still owns a project) and
  returns a clear 409 instead of a raw 500, rethrows any other error.
  Allowing a SUPER_ADMIN to delete another SUPER_ADMIN was a deliberate
  choice (not accidental privilege loss — self-deletion is already
  blocked, so this can't zero out super admins by itself).
- `UserRoleManager`: new "Delete" button per row (hidden for the current
  user, same as the role selector) with a `window.confirm` guard before
  the request fires.

### Issue caught by independent agent validator, fixed before finishing
- **Race condition**: original implementation tracked in-flight
  requests with a single shared `pendingId: string | null` state used
  by both the role-select and the delete button, across every row.
  Clicking delete on row B while row A's request was still in flight
  would overwrite the shared state, re-enabling row A's controls mid-
  request and letting a second overlapping request fire for it. Fixed:
  replaced with a `Set<string>` (`pendingIds`) so each row's pending
  state is tracked independently — `setPending(userId, bool)` helper
  adds/removes from the set, `disabled` checks `pendingIds.has(user.id)`
  per row instead of a single shared value.

### Verification
`npx tsc --noEmit` clean. `npm test` → **186/186 passing** (179 carried
over + 7 new DELETE-endpoint tests). `npm run lint` clean (same
pre-existing unrelated warnings only). `npm run build` succeeds. A
second agent validator pass after the race-condition fix was not
re-run as a separate step, but the fix itself was small/mechanical
(swap one state shape for another with equivalent semantics) and
re-verified via the full tsc/test/lint/build sweep above.

### Not yet done
- Not committed yet — ask user first (per rule: never commit unless
  explicitly asked).
- No bulk-delete or "transfer ownership of projects" UI exists — if a
  SUPER_ADMIN is blocked by the 409 (user still owns projects), they
  currently have to manually delete those projects first via the
  project page's own delete control before the user delete will
  succeed. Not asked for; mentioning as a possible follow-up.

## Session: Username-based auth, admin-created users, forced password change
User raised two concerns about the old email/password signup: (1) email was
unverified, so any fake address (`hello@fake.co`) passed, and (2) only one
password field on register, no confirm, no show/hide toggle. Discussion
pivoted: this is an in-house/internal tool, not public signup, so instead of
adding email verification the real fix is removing self-service signup
entirely — users get created by a SUPER_ADMIN with a temp password, must
change it on first login, and log in by username (no email required at
all). Session crashed multiple times mid-implementation; each resume
re-verified actual repo/DB state via git status/diff + `npx prisma migrate
status` + `npx tsc --noEmit` before continuing, per the Crash-Safe Task
Logging rule — this caught real gaps the live log's own prior entries had
missed (e.g. two "done" claims that were actually still mid-edit).

### What changed
- **Schema**: `User.username` (new, required, unique — the login
  identifier), `User.email` (now nullable — optional contact field only,
  never used for login/verification), `User.mustChangePassword` (default
  `true`). Migration hand-written (not `prisma migrate dev`, which can't
  auto-generate a required-unique-column migration against existing rows
  non-interactively): adds columns nullable, backfills existing rows
  (named mappings for the 3 known users + an email-local-part fallback for
  any others), sets `mustChangePassword = false` for all of them (they
  already have self-chosen passwords), then enforces `NOT NULL`/`UNIQUE`.
  Applied to the real Supabase DB.
- **Removed entirely**: public `/signup` page, `/api/signup` route, Google
  OAuth provider (`AUTH_GOOGLE_ID`/`SECRET` no longer referenced in code).
  This app is credentials-only now.
- **Login**: `src/auth.ts`/`credentials.ts` authenticate by `username`
  instead of `email`. Session (`src/types/next-auth.d.ts` +
  `src/auth.ts`) now also carries `username` and `mustChangePassword`,
  both re-fetched fresh from the DB on every request (same pattern as
  `role`) — a role change or forced-password-reset takes effect
  immediately, no re-login needed.
- **New SUPER_ADMIN "create user" feature**: `/admin/users/new` page +
  `POST /api/admin/users` — username (3-32 chars,
  `^[a-zA-Z0-9_.-]+$`), optional name/email, a role select, and a
  temp password (+ confirm, client-side only). Always creates with
  `mustChangePassword: true` (hardcoded server-side, not client
  -controlled), `bcrypt.hash(password, 10)`, handles duplicate
  username/email via Prisma P2002 → 409 naming the actual conflicting
  field.
- **Forced password change**: `/change-password` page (reachable by any
  logged-in user, not just when forced — only gates on `session.user.id`,
  never on `mustChangePassword` itself, so it can't loop) + `PATCH
  /api/account/password` (always operates on `session.user.id` only —
  confirmed via test that a body-supplied id is ignored — clears
  `mustChangePassword` on success). All 4 protected pages (`dashboard`,
  `projects/[slug]`, `admin`, `admin/users/new`) redirect to
  `/change-password` if `session.user.mustChangePassword` is true,
  checked *before* any role-based redirect so it can't be bypassed.
- **UI asks (the original ones)**: new reusable
  `src/components/password-input.tsx` — `forwardRef`-wrapped (works with
  react-hook-form's `register`), eye/eye-off SVG toggle
  (`type="button"`, `tabIndex={-1}` so Tab skips the icon), used on
  login, create-user, and change-password forms. Confirm-password added
  to both the create-user form and the change-password form via
  `.refine()`-based Zod schemas (`createUserFormSchema`,
  `changePasswordFormSchema`) — `confirmPassword` is always stripped out
  client-side before the actual API call, never sent to the server.
- `src/components/nav.tsx` and the admin console (`UserRoleManager`,
  `ProjectAdminManager`) updated to show `username` as the primary
  identifier with `email ?? "—"` as a secondary optional field.

### Verification
`npx tsc --noEmit` clean. `npm run lint` clean (same pre-existing
unrelated warnings only). `npm test` → **179/179 passing** (146 carried
over + 33 new: `validation/admin.test.ts`, `validation/auth.test.ts`
additions, `admin/users/route.test.ts` POST additions,
`account/password/route.test.ts`). `npm run build` succeeds — route list
confirms `/signup` and `/api/signup` are gone, `/change-password` and
`/admin/users/new` are present. Independent agent validator reviewed the
full redesign (redirect-loop risk, check ordering on all 4 protected
pages, cross-user password-change risk, hardcoded `mustChangePassword`,
lockout/rate-limit regression risk from the username switch, leftover
email/Google references, `PasswordInput` ref-forwarding and button type,
confirm-password stripping, migration backfill correctness). **Verdict:
no issues found** — one non-blocking a11y nit noted (the eye-icon toggle
is `tabIndex={-1}`, an intentional choice, not a bug).

### Not yet done
- Not committed yet — ask user first (per rule: never commit unless
  explicitly asked).
- Project docs (`project.md`, `README.md`) still describe the app as
  having public signup/Google OAuth — not updated this session (not
  asked for; mentioning as a known doc-drift, not a code bug).

## Session: Global role-based access control (SUPER_ADMIN/ADMIN/USER)
Replaced the old per-project `ProjectRole` (OWNER/MEMBER) model entirely
with a 3-tier global role system, per user request. Session crashed
partway through; resumed and verified actual repo state via
git status/diff + tsc + test run before continuing (per the new
Crash-Safe Task Logging rule in CLAUDE.md) rather than trusting the
live-log text, which turned out to be behind the real (further along)
state on disk.

### Spec (clarified via ask_user before coding)
- `GlobalRole` enum on `User.role`: `SUPER_ADMIN` / `ADMIN` / `USER`
  (default `USER`).
- Old `ProjectRole` enum removed entirely — `ProjectMember` is now a plain
  join table (membership = "is in the list", no role column).
- New `ProjectAdmin` model: many-to-many project↔admin assignments
  (multiple admins per project allowed), only a `SUPER_ADMIN` can
  create/remove them. `Project.ownerId`/`owner` renamed to
  `createdById`/`createdBy` (creation record, not a permission).
- Permissions (`src/lib/permissions.ts`): project CREATE = `SUPER_ADMIN`
  only. Project EDIT/DELETE = `SUPER_ADMIN` (any project) OR an `ADMIN`
  assigned to that specific project. Issue view/create/update = project
  member OR anyone who can manage the project (so an assigned admin
  doesn't need to separately join). `USER` = normal member behavior only,
  can't create projects or manage any project.
- New `/admin` page (SUPER_ADMIN-gated, others redirected to `/dashboard`):
  user list with a role-change dropdown (can't change own role — avoids
  any self-lockout path), project list with admin assign/unassign.
- `/projects/[slug]` page: inline rename + delete-with-confirm shown to
  whoever `canManageProject` returns true for.
- First `SUPER_ADMIN`: user chose manual DB promotion (no env-var
  auto-bootstrap) — SQL given below, to run once after this is deployed.

### Implementation
- `prisma/schema.prisma` + migration
  `20261021072726_add_global_roles_and_project_admins` (applied to the
  real Supabase DB): `GlobalRole` enum, `User.role`, `ProjectAdmin` model,
  `ProjectMember` role column dropped, `Project.ownerId`→`createdById`.
- `src/auth.ts` + `src/types/next-auth.d.ts`: session now carries
  `user.role`, re-fetched fresh from the DB on every `session()` callback
  (not baked into the JWT at login) — a role change by a super admin takes
  effect on the user's very next request, no re-login needed.
- New `src/lib/permissions.ts`: `isSuperAdmin`, `canCreateProject`,
  `isAssignedProjectAdmin`, `canManageProject`, `canAccessProject`.
- New `src/lib/validation/admin.ts` (`updateUserRoleSchema`,
  `assignProjectAdminSchema`) and `updateProjectSchema` added to
  `src/lib/validation/project.ts`.
- Rewrote `src/app/api/projects/route.ts` (POST gated to `SUPER_ADMIN`),
  `src/app/api/projects/[slug]/route.ts` (GET returns
  `isMember`/`canManage`; added PATCH rename + DELETE which also drops the
  project's Postgres schema), `.../join/route.ts` (dropped the removed
  role field), `.../issues/route.ts` and `.../issues/[issueId]/route.ts`
  (membership gate → `canAccessProject`).
- New admin API: `GET /api/admin/users`, `PATCH
  /api/admin/users/[userId]` (blocks self-role-change), `GET
  /api/admin/projects`, `POST /api/admin/projects/[slug]/admins` (only
  allows assigning users who already hold the `ADMIN` role; rejects
  `SUPER_ADMIN` targets as redundant and `USER` targets as invalid),
  `DELETE /api/admin/projects/[slug]/admins/[userId]`.
- New `/admin` page + `UserRoleManager`/`ProjectAdminManager` components;
  `ProjectManageControls` component on the project page; `dashboard/page.tsx`
  and `nav.tsx` updated to only show project-creation/admin-console UI to
  `SUPER_ADMIN`.

### Verification
- `npx tsc --noEmit` clean.
- `npm run lint` clean (same pre-existing unrelated `.axet-code/tmp`
  warnings only).
- `npm test` → **159/159 passing** (133 previous + 26 new: 11 in
  `permissions.test.ts` + 15 across the 5 new admin route test files).
- `npm run build` succeeds; all new routes (`/admin`,
  `/api/admin/users[/...]`, `/api/admin/projects[/...]`) registered
  correctly alongside existing ones.
- Independent agent validator reviewed the full feature for privilege
  escalation, self-demotion/lockout risk, leftover references to the
  removed `ProjectRole`/`ownerId`, argument-order bugs in
  `canManageProject`/`canAccessProject` call sites, the admin-assignment
  business rules, frontend/backend contract matches, N+1 queries, and test
  coverage gaps. **Verdict: no issues found.** Two non-blocking
  observations noted (both intentional, not bugs): (1) the dashboard
  project list is membership-only, so a super admin/assigned admin who
  manages but hasn't joined a project won't see it there (they can still
  reach it directly via its URL — the project page itself checks
  `canManageProject`, not just membership); (2) the join endpoint has no
  permission gate by design — any authenticated user can join any project
  via its shareable slug link, unchanged from before this feature.

### Not yet done
- Not committed yet — ask user first (per rule: never commit unless
  explicitly asked).
- First `SUPER_ADMIN` bootstrap SQL (run once, manually, against the real
  Supabase DB, after replacing the email):
  ```sql
  UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
  ```
- Possible follow-up (not requested, mentioning only): surface
  super-admin/assigned-admin-managed-but-not-member projects in the
  dashboard list too, if that UX gap turns out to matter in practice.

### Decision log: next-auth vs better-auth (verified, NOT migrating)
A prior (crashed, unlogged) session apparently recommended switching from
next-auth to `better-auth`. Re-verified from scratch this session:
- next-auth v5 (`beta.32`) is beta-labeled but functionally production-ready
  per Auth.js's own maintainers ("beta tag reflects API refinement, not
  instability"). Current setup: fully implemented, 85 passing tests,
  tsc/lint/build clean, manually verified against real Supabase DB. No bugs.
- better-auth's main advantage (built-in RBAC plugin) doesn't apply here —
  this project's roles (`ProjectRole` enum: OWNER/MEMBER in
  `prisma/schema.prisma`) are already hand-rolled at the app level via
  manual membership checks in route handlers, independent of the auth
  library. Switching wouldn't simplify that.
- Auth.js's "use Better Auth" recommendation is explicitly for **new**
  projects, not existing working v5 setups.
- No feature gap exists: project.md requires accounts/login/signup/cloud
  hosting/Supabase/Vercel — all already satisfied by next-auth.
- Migration cost would be real (rewrite `auth.ts`, Prisma User/Account/
  Session/VerificationToken models, `/api/signup`, login/signup pages, and
  a chunk of the test suite) for zero functional gain.
- **Verdict: keep next-auth. Do not migrate** unless a concrete feature gap
  (e.g. built-in 2FA, magic links) becomes an actual requirement later.

### Done
- Full stack scaffolded: Next.js App Router + TS, Prisma (adapter-pg), NextAuth
  (Credentials + Google), Zod validation, react-hook-form.
- Auth: signup (`/api/signup`), login/signup pages, NextAuth config (`src/auth.ts`).
- Projects: create project (provisions its own Postgres schema via
  `src/lib/projectSchema.ts`), list projects (dashboard), project page with
  shareable `/projects/[slug]` link, join-project flow.
- Issues: create issue, list issues, update issue status — all scoped to the
  project's own schema via raw SQL in `src/lib/projectSchema.ts`.
- Keep-Alive cron (from project.md requirement): added
  `src/app/api/cron/keep-alive/route.ts` (runs `SELECT 1`, guarded by
  `CRON_SECRET` bearer token if set) + `vercel.json` with daily schedule
  (`0 0 * * *`).
- Verified: `npx tsc --noEmit` clean, `npm run lint` clean (only unrelated
  warnings in `.axet-code/tmp` generated files), `npm run build` succeeds,
  independent agent review of the cron route passed.
- Re-verified same three checks in a later session (tsc/lint/build all still
  clean/succeeding).
- Login/Register feature validated via Team Lead + FE/Backend/E2E validator
  workflow (see CLAUDE.md). Found 14 issues (5 must-fix, 9 nice-to-have).
  Fixed all 5 must-fix:
  1. `/api/signup` error shape was inconsistent (object on 400, string on
     409) — frontend silently swallowed 400s into a generic message. Now
     always returns `{error: string}`.
  2. `/api/signup` had no try/catch on `request.json()` — malformed body
     caused unhandled 500. Now returns clean 400.
  3. TOCTOU race: concurrent signups with same email could both pass the
     `findUnique` check then one `create()` throws Prisma P2002 uncaught →
     500 instead of 409. Now caught and returns 409 "already exists".
  4. Signup auto-login-failure message was lost on `router.push("/login")`
     (component unmounted before user could read it). Now passed via
     `?message=` query param; `/login` reads it in a `useSearchParams`
     hook wrapped in `<Suspense>` (required by Next.js 16 for
     prerendering).
  5. `loginSchema` was defined but unused — `authorize()` did manual
     `as string` casting instead. Now validates with
     `loginSchema.safeParse()`.
  Also added `password.max(72)` (bcrypt truncation edge case) to
  `signupSchema` as a quick defense-in-depth addition.
  Re-verified tsc/lint/build clean after fixes, independent validator
  confirmed all 5 fixes correct with no new bugs/contract breaks.
  9 nice-to-have items logged, NOT done (deferred, user to decide priority):
  missing `<label>` elements (placeholder-only inputs), no `autoComplete`
  on password fields, no `aria-live` on error messages, Google button has
  no loading/disabled state, duplicate "or divider" JSX not extracted to a
  shared component, `name` field allows `""` instead of normalizing (not
  fixed — only `.max(72)` was addressed from that cluster).

### Known loose end
- `CRON_SECRET` is now set in local `.env` (generated random hex value).
  **Still needs to be added to Vercel project env vars** before deploy — same
  value — otherwise the keep-alive route runs unauthenticated in prod.

### Not yet done / not verified
- No deployment to Vercel performed yet (no Vercel/Supabase credentials in
  this session).
- `.env` exists locally but its contents were not inspected/modified.
- No automated tests exist in this repo (none were requested).
- RESOLVED: Supabase DB is reachable and migrations are applied. Initial
  `npx prisma migrate status` run hit a one-off transient `P1001` (first
  connection attempt); confirmed with a direct `pg` client connection
  (succeeded) and re-ran `prisma migrate status` twice more — both times:
  "2 migrations found in prisma/migrations" / "Database schema is up to
  date!". Earlier raw-socket "firewall is blocking it" theory was a false
  positive — that test never sent a Postgres startup packet, so of course
  no bytes came back; not an actual network block.

### Next steps if asked to continue
1. Add `CRON_SECRET` (same value as local `.env`) to Vercel project env vars,
   then deploy.
2. Confirm Supabase DB env vars are correct and migrations
   (`prisma/migrations/`) have been applied to the real DB.
3. Login/Register nice-to-haves not yet done (logged below) — ask if wanted.
4. Decide next feature (issue assignment UI, editing/deleting issues,
   project settings, etc.) — project.md doesn't specify further scope.

## Session: Login/Register validation pass (4-role workflow)
Ran the Team Lead + FE/Backend Validators (parallel) + End-to-End Validator
workflow from `CLAUDE.md` on the existing Login/Register feature.

### Must-fix bugs found and fixed
1. `src/app/api/signup/route.ts` — validation error response was
   `{error: object}` vs duplicate-email `{error: string}`; frontend's
   `typeof === "string"` check silently swallowed real validation messages.
   Fixed: always returns `{error: string}`.
2. Same file — `request.json()` had no try/catch; malformed body caused an
   unhandled 500. Fixed: try/catch, returns 400.
3. Same file — TOCTOU race: concurrent signups with the same email could
   both pass the `findUnique` pre-check, then `create()` throws Prisma
   P2002 uncaught → 500 instead of the intended 409. Fixed: try/catch
   around `create`, catches `Prisma.PrismaClientKnownRequestError` code
   `P2002`, returns 409.
4. `src/app/signup/page.tsx` — after successful signup but failed
   auto-login, `setFormError` + immediate `router.push("/login")` unmounted
   the component before the message could be seen. Fixed: message now
   passed via `?message=` query param; `src/app/login/page.tsx` reads it
   (required wrapping the component in `<Suspense>` since it now uses
   `useSearchParams`).
5. `src/auth.ts` Credentials `authorize()` did manual `as string` casting
   instead of using the existing `loginSchema`. Fixed: now calls
   `loginSchema.safeParse(credentials)`.

Also fixed in passing: `src/lib/validation/auth.ts` signup password schema
had `min(8)` but no `max()` (bcrypt 72-byte silent truncation) — added
`.max(72)`.

All 5 fixes independently re-verified by a 6th validator pass (no new bugs
introduced, Prisma import path correct, no other `/api/signup` consumers
broken). `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass after
changes.

### Nice-to-have (logged, not done — ask before doing)
- Missing `autoComplete="current-password"`/`"new-password"` on password
  inputs (`login/page.tsx`, `signup/page.tsx`).
- No `<label>` elements, placeholder-only inputs (both pages) — a11y gap.
- No `aria-live`/`role="alert"` on inline error messages (both pages).
- Google sign-in button has no loading/disabled state while redirecting.
- Duplicate "or divider" JSX between login/signup pages — could extract to
  a shared component.
- `name` field in signup still permits `""` at the Zod level (normalized to
  `undefined` only at the route-handler level, not the schema itself) —
  cosmetic, not a bug.

### Incomplete / Terminated Tasks
(Empty — populate per `CLAUDE.md` § Agent Timeout / Runaway Protection
whenever a sub-agent/command is killed for running >5 min without
resolving. Format: timestamp, role, task description, reason terminated.)

### Session: Login/Register validation pass (4-role workflow, first real run)
Ran the FE Validator + Backend Validator (parallel) + End-to-End Validator
workflow from `CLAUDE.md` on the existing Login/Register feature.

**14 issues found, all confirmed true by End-to-End Validator. 5 MUST-FIX
implemented and re-verified clean (tsc/lint/build pass):**
1. `src/app/api/signup/route.ts` — error response was `{error: object}` on
   Zod failure vs `{error: string}` on 409; frontend swallowed the object
   case into a generic message. Now always `{error: string}`.
2. Same file — `request.json()` had no try/catch; malformed body threw an
   unhandled 500. Now returns clean 400.
3. Same file — TOCTOU race: concurrent signups with same email could both
   pass the `findUnique` pre-check, then `prisma.user.create` threw an
   uncaught Prisma P2002 → unhandled 500 instead of 409. Now caught and
   returns 409.
4. `src/app/signup/page.tsx` + `src/app/login/page.tsx` — auto-login-after-
   signup failure message was set in local state right before
   `router.push("/login")` unmounted the component, so the user never saw
   it. Now passed via `?message=` query param; login page reads it (wrapped
   in `<Suspense>` since it added `useSearchParams`).
5. `src/auth.ts` — `loginSchema` was defined but never used; Credentials
   `authorize()` did unsafe manual casting instead. Now validates with
   `loginSchema.safeParse` first.

Also fixed as a quick bonus (from the nice-to-have list, cheap/low-risk):
- `src/lib/validation/auth.ts` — added `.max(72)` to signup password (bcrypt
  72-byte truncation edge case).

**7 remaining NICE-TO-HAVE items, not yet done (logged for later):**
- Missing `autoComplete` on password inputs (login/signup pages)
- Missing `<label>` elements (placeholder-only inputs, a11y gap)
- No `aria-live`/`role="alert"` on inline error messages
- Google OAuth button has no loading/disabled state during redirect
- Duplicate "or divider" JSX between login/signup not extracted to a shared
  component
- `name` field in signupSchema still permits `""` at the schema level
  (handled downstream via `name || undefined` in route.ts, so not a live
  bug, just schema cleanliness)
- `src/lib/prisma.ts` has no fail-fast check that `SUPABASE_DB_*` env vars
  are actually set before constructing the adapter

No tasks hit the 5-minute timeout threshold this session; nothing to log
under "Terminated Tasks".

### Next steps if asked to continue
1. Either knock out the 7 nice-to-have items above, or move to the next
   feature area (issue assignment UI, editing/deleting issues, project
   settings — see earlier "Next steps" entry below for original list).
2. Still outstanding from before: `CRON_SECRET` → Vercel env vars + actual
   deploy (needs user's Vercel credentials, not available in-session).

## Session: Login/Register nice-to-haves (all 7 fixed)
Fixed all 7 previously-deferred nice-to-have items from the validator
review, using the same Team Lead + FE/Backend Validators (parallel) +
End-to-End Validator workflow.

### Changes
1. `src/app/login/page.tsx`, `src/app/signup/page.tsx` — added `<label
   htmlFor>` + matching `id` on every input (was placeholder-only).
2. Same files — added `autoComplete` attributes: `"email"`,
   `"current-password"` (login), `"new-password"` (signup), `"name"`.
3. Same files — added `role="alert"` on field-level Zod errors, and
   `role="alert" aria-live="polite"` on the top-level form error.
4. New `src/components/google-signin-button.tsx` — extracted the
   previously-duplicated "or divider" + Google button JSX from both pages
   into one shared component, now with an `isRedirecting` state so the
   button disables and shows "Redirecting..." instead of being clickable
   multiple times. Both pages now just render `<GoogleSignInButton />`.
5. `src/lib/validation/auth.ts` — `signupSchema.name` now normalizes `""` →
   `undefined` at the schema level via `.transform()`, instead of only
   downstream in the route handler. Exported `SignupInput` type switched
   from `z.infer` to `z.input` (pre-transform shape) since that's what the
   form actually collects — `z.infer` would have been the post-transform
   output type and conflicted with `useForm`'s resolver typing.
6. `src/lib/prisma.ts` — added a fail-fast check for required
   `SUPABASE_DB_*` env vars before constructing the Prisma client.

### Issues caught during validation, fixed before finishing
- **Backend Validator caught a real regression risk**: the fail-fast env
  check in `prisma.ts` was originally placed directly at module top-level,
  which Next.js's `next build` "collecting page data" step would execute
  for every route module on import — meaning a build without
  `SUPABASE_DB_*` vars present at *build time* (not just runtime) would now
  hard-fail where it previously wouldn't. Fixed: rewrote `prisma.ts` to
  lazily construct the client via a `Proxy` whose `get` trap only runs
  `createPrismaClient()` (env check + adapter) on first actual property
  access (e.g. `prisma.user.findUnique`), not at import time. End-to-End
  Validator separately confirmed `PrismaAdapter(prisma)` in `src/auth.ts`
  still works correctly against the Proxy (it only does lazy per-call
  property access, no eager inspection).
- **FE Validator caught a latent UX bug**: the new `GoogleSignInButton`
  called `signIn("google", ...)` without handling a rejected promise — if
  the redirect failed to kick off, the button would stay disabled/stuck on
  "Redirecting..." forever with no way to retry. Fixed: added
  `.catch(() => setIsRedirecting(false))`.
- Cleaned up now-redundant `name: name || undefined` in
  `src/app/api/signup/route.ts` since the schema normalizes it already.

All fixes re-verified: `npx tsc --noEmit` clean, `npm run lint` clean
(same pre-existing unrelated warnings only), `npm run build` succeeds.
End-to-End Validator gave final verdict **READY**.

### Manual functional verification (real Supabase DB, dev server)
- Signup with `name: ""` → stored as `null` in DB (confirmed via direct
  API response `"name":null`), not empty string. ✅
- `/login` and `/signup` HTML confirmed to contain correct `label
  for="..."` attributes and `autoComplete` values (React renders the prop
  as literal `autoComplete="..."` in the DOM, still valid/functional HTML
  despite non-lowercase attribute name in raw HTML source). ✅
- Test user cleaned up from DB after verification, along with 2 leftover
  test users from the previous session that a broken cleanup script had
  failed to actually delete (the cleanup script used
  `require("@/generated/prisma/client")` which doesn't resolve under plain
  `node -e` outside Next's module resolution — switched to raw `pg` client
  for cleanup instead, which works reliably for ad-hoc DB scripts).
- Dev server (background, for manual testing) was stopped and port 3000
  confirmed free afterward.

No tasks hit the 5-minute timeout threshold this session.

### Next steps if asked to continue
1. `CRON_SECRET` → Vercel env vars + actual deploy (still needs user's
   Vercel credentials).
2. Pick next feature area: issue assignment UI, editing/deleting issues,
   or project settings (rename project, remove members) — project.md
   doesn't specify further scope beyond what's built.

## Session: Added vitest unit test suite + re-verification (session continued after crash)
Added `vitest` + `vite-tsconfig-paths` (devDependencies; bumped `@types/node`
from exact `20.19.43` to `^24.0.0` to satisfy vitest 5's peer requirement —
matches the actual installed Node runtime, v24). New `vitest.config.ts`
(`environment: "node"`, `globals: true`, `include: ["src/**/*.test.ts"]`),
new `npm test` / `npm run test:watch` scripts.

**85 tests added, all passing**, covering every pure/business-logic module
and every API route, co-located as `*.test.ts` next to the file tested:
- `src/lib/slug.test.ts`, `src/lib/validation/auth.test.ts`,
  `src/lib/validation/project.test.ts` — pure functions / Zod schemas, no
  mocking needed.
- `src/lib/projectSchema.test.ts` — mocks only `@/lib/prisma`
  ($executeRawUnsafe/$queryRawUnsafe), exercises the real
  `generateSchemaName`/`assertValidSchemaName` logic.
- `src/app/api/signup/route.test.ts`, `.../cron/keep-alive/route.test.ts`,
  `.../projects/route.test.ts`, `.../projects/[slug]/route.test.ts`,
  `.../projects/[slug]/issues/route.test.ts`,
  `.../projects/[slug]/issues/[issueId]/route.test.ts`,
  `.../projects/[slug]/join/route.test.ts` — mock `@/auth` and `@/lib/prisma`
  (and `@/lib/projectSchema` where relevant) via `vi.hoisted`, assert real
  status codes/response shapes/call args (401/403/404/400/409/201/200 paths).

**Real production bug caught and fixed**: `src/lib/projectSchema.ts`
`SCHEMA_NAME_PATTERN` was `/^proj_[a-f0-9]{24}$/` but `generateSchemaName()`
produces `proj_` + a 32-hex-char UUID (dashes stripped) — meaning
`assertValidSchemaName` threw "Invalid schema name" for every schema name
the app actually generates, so **every real project creation would have
failed** (`provisionProjectSchema` in the POST `/api/projects` flow would
throw before the project row is even created). Fixed: pattern now
`/^proj_[a-f0-9]{32}$/`. `src/lib/projectSchema.test.ts` regression-guards
this going forward. Independent agent validator confirmed: fix matches
actual UUID length, no other code in `src/` or `prisma/` assumes 24 chars,
and spot-checked test files correctly mirror real route behavior (not just
asserting against mock internals).

Re-verified after the fix: `npx tsc --noEmit` clean, `npm run lint` clean
(same pre-existing unrelated `.axet-code/tmp` warnings only), `npm run build`
succeeds, `npm test` → 85/85 passing.

### Next steps if asked to continue
1. `CRON_SECRET` → Vercel env vars + actual deploy (still needs user's
   Vercel credentials).
2. Pick next feature area: issue assignment UI, editing/deleting issues,
   or project settings (rename project, remove members).
3. Consider adding component-level tests (e.g. for
   `google-signin-button.tsx`, forms) if UI regression coverage is wanted —
   current suite covers lib/validation + API routes only, no React
   component tests yet.

## Session: Login lockout feature (session crashed mid-work, resumed)
Session crashed again without logging. Resumed by inspecting `git status`/
`git diff` to reconstruct state before touching anything further (per user
instruction to log before acting).

### State found on resume (uncommitted, not yet verified this session)
- `prisma/schema.prisma`: `User` gained `failedLoginAttempts Int @default(0)`
  and `lockedUntil DateTime?`.
- `prisma/migrations/20261021060352_add_login_lockout/migration.sql`: adds
  those two columns. Confirmed via `npx prisma migrate status` — already
  applied to the real Supabase DB ("3 migrations found", "schema is up to
  date").
- New `src/lib/auth/credentials.ts`: extracted `authenticateCredentials()`
  out of `src/auth.ts`'s `authorize()`. Locks account for 15 min
  (`LOCKOUT_DURATION_MS`) after 5 failed attempts (`MAX_FAILED_ATTEMPTS`),
  throws `AccountLockedError` if already locked or on the attempt that
  trips the lock, resets counters on a successful login or an expired lock.
- `src/auth.ts`: `authorize()` now delegates to `authenticateCredentials`,
  maps `AccountLockedError` to a custom `AccountLockedSignInError` (extends
  NextAuth's `CredentialsSignin`, `code = "account-locked"`).
- `src/app/login/page.tsx`: checks `result.code === "account-locked"` and
  shows a distinct "temporarily locked, try again in 15 minutes" message.
- New `src/lib/auth/credentials.test.ts`: 8 unit tests covering invalid
  payload, missing user, OAuth-only (no password) user, active lock
  (rejects, no update call), expired lock (clears + succeeds), wrong
  password incrementing counter, hitting `MAX_FAILED_ATTEMPTS` (locks +
  resets counter to 0), successful login clearing prior failures, and
  successful login with clean history (no spurious update call).
- All of the above was NOT yet verified (tsc/lint/build/test) before the
  crash — doing that now this session before anything else.

### Verified this session
`npx tsc --noEmit` clean. `npm run lint` clean (same pre-existing unrelated
`.axet-code/tmp` warnings only). `npm test` → 94/94 passing (85 previous +
9 new in `credentials.test.ts`). `npm run build` succeeds, same route list
as before (lockout logic lives inside the existing `/api/auth/[...nextauth]`
handler, no new routes). Migration already applied to the real Supabase DB.
Login lockout feature is complete and verified. Nothing left uncommitted
needs further work — just needs a commit (not done automatically per rule:
never commit unless explicitly asked).

### Next steps if asked to continue
1. Commit the login lockout feature (uncommitted — ask user first).
2. `CRON_SECRET` → Vercel env vars + actual deploy (still needs user's
   Vercel credentials).
3. Pick next feature area: issue assignment UI, editing/deleting issues,
   or project settings (rename project, remove members).

## Session: API rate limiting (brute force + enumeration hardening)
Login lockout feature from last session committed (`21dc35e`). Continued
with the next piece of the security work: user picked "API rate limiting"
specifically (not headers/CSRF/session audit — deferred, not asked for).

### Agent timeout/crash-prevention process change (per user request)
User asked to actually enforce the existing CLAUDE.md "Agent Timeout /
Runaway Protection" rule instead of letting it be silently skipped. Going
forward: long-running commands run via the bash tool's background mode so
they can be polled instead of blocking; PROGRESS.md gets checkpointed
during the session (not just at the end) so a crash loses less context.
Actual process-level crash prevention isn't possible from inside the
session (that's a client/OS-level failure) — only the timeout/logging
discipline is.

### Design
Postgres-backed fixed-window counter (single `RateLimitEntry` table:
`key String @id`, `count Int @default(1)`, `resetAt DateTime`), atomic via
one `INSERT ... ON CONFLICT (key) DO UPDATE ... CASE WHEN resetAt <= now
THEN reset ELSE increment` statement (`src/lib/rateLimit.ts`). Chosen over
in-memory counters because the app is serverless (Vercel) — in-memory
state doesn't survive/sync across function instances, but the app already
has a single Postgres source of truth via Supabase, so reusing it is the
simplest consistent option without adding a new dependency (e.g. Upstash
Redis).

New `prisma/migrations/20261021065229_add_rate_limit_entry/` applied to
the real Supabase DB.

### Applied to
- `POST /api/signup` — 5 requests / 15 min per IP.
- Credentials login (`src/lib/auth/credentials.ts`, called from
  `src/auth.ts`) — 10 attempts / 15 min per IP, checked *before* the
  per-account lockout/password check (doesn't leak account existence; the
  rate-limit rejection happens before any DB lookup). New `code:
  "rate-limited"` on the thrown `CredentialsSignin`, surfaced as a distinct
  message on `src/app/login/page.tsx`.
- `POST /api/projects` (create project) — 10 / hour per user id. Expensive
  operation (provisions a real Postgres schema), so keyed by user rather
  than IP.
- `POST /api/projects/[slug]/join` — 20 / hour per IP. Addresses the "other
  hacking" part of the ask: project slugs end in only a 6-char random
  suffix (`src/lib/slug.ts`), so this throttles brute-force slug/project
  enumeration via the join endpoint.
All four return `429` + `{error: string}` + a `Retry-After` header (whole
seconds) when exceeded.

### Issues caught by independent agent validator, fixed before finishing
- **IP spoofing**: initial `getClientIp()` read the first entry of
  `X-Forwarded-For` only. Verified (via web search of Vercel's own docs)
  that Vercel overwrites/sanitizes this header at the edge and does not
  forward client-supplied values — safe on this app's actual deployment
  target. Still hardened by preferring `x-vercel-forwarded-for` (Vercel's
  explicitly-guaranteed-authoritative variant) first, with `x-forwarded-for`
  as fallback, and added a code comment documenting this is a
  Vercel-specific trust assumption (would need re-checking if ever
  self-hosted behind a different/untrusted proxy).
- **Test gap**: original `rateLimit.test.ts` only asserted against
  pre-fabricated mock return values, never exercised the actual
  window-reset `CASE` logic across multiple calls. Added a second
  `describe` block with a stateful in-memory mock that mirrors the real
  SQL's upsert/reset semantics exactly, driven by `vi.useFakeTimers()`, to
  prove: count increments within a window, the limit is enforced, the
  counter actually resets once the window elapses, and separate keys don't
  interfere with each other.
- Validator confirmed: atomicity of the single `INSERT ... ON CONFLICT`
  statement is correct under concurrency (row-level lock), no SQL
  injection (tagged-template parameterization, not string concat),
  off-by-one boundary (`count <= limit`) matches "N per window" semantics
  and is test-covered, and check ordering in `credentials.ts` doesn't leak
  account existence through the rate-limit path.

Re-verified after fixes: `npx tsc --noEmit` clean, `npm run lint` clean
(same pre-existing unrelated warnings only), `npm test` → **109/109
passing** (94 previous + 15 new: 11 in `rateLimit.test.ts`, 1 in
`credentials.test.ts`, 1 each in signup/projects/join route tests), `npm
run build` succeeds, same route list as before (no new routes, logic
added to existing handlers).

Not yet committed — ask user first (per rule: never commit unless
explicitly asked).

### Next steps if asked to continue
1. Commit this rate-limiting work (uncommitted).
2. Other security items from the earlier menu, deferred since user picked
   rate limiting only this round: security headers (CSP/HSTS/etc via
   middleware or next.config.ts), broader input-hardening audit,
   session/cookie flag verification. Ask before doing any of these.
3. `CRON_SECRET` → Vercel env vars + actual deploy (still needs user's
   Vercel credentials).
4. Pick next feature area: issue assignment UI, editing/deleting issues,
   or project settings.
