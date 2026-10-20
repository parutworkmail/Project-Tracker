# Progress Log

Read this file first in any new session to see what's done and what's next.

## Status: core app complete, keep-alive cron added

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
