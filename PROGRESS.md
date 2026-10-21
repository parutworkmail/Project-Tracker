# Progress Log

Read this file first in any new session to see what's done and what's next.

### Live Task Log
(Read this FIRST on every session start — see CLAUDE.md "Crash-Safe Task
Logging". Shows exactly what was happening if the last session crashed.)

- **Plan**: (none in progress)
- **Status**: idle.
- **Next**: none — awaiting next user request. Last completed work: 3-tier
  global role (SUPER_ADMIN/ADMIN/USER) RBAC feature, verified clean
  (tsc/lint/build/159 tests/agent validator), not yet committed — see
  "Session: Global role-based access control" below for full details.

## Status: core app complete, keep-alive cron added

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
