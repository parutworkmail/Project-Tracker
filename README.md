# Project Tracker

A JIRA-like project and task tracker. Accounts are created by an administrator, every project lives at its own URL (`/{slug}`), and each project keeps its tasks in its own isolated Postgres schema.

For what the app can and cannot do, in business terms, see [`docs/FEATURES.md`](docs/FEATURES.md). For the engineering history, see [`PROGRESS.md`](PROGRESS.md).

## Highlights

- **Roles**: `SUPER_ADMIN`, `ADMIN` (manages only the projects they are assigned to) and `USER`.
- **Tasks**: title, description, status, priority, due date, assignee, comments, search, filters, sorting and pagination.
- **Projects**: shareable links, members can join or leave, managers can rename, re-link, delete and manage members.
- **Admin console**: create, edit and delete users, reset passwords, change roles, assign project admins, and review who assigned whom.
- **Security**: username and password login (no public signup), forced password change on first login, account lockout, database-backed rate limiting, and security headers (CSP, HSTS, frame and sniffing protection).
- **UX**: light, dark and system themes, responsive tables and dialogs, keyboard and screen-reader friendly controls.

## Tech stack

Next.js 16 (App Router, Cache Components) and TypeScript, Tailwind CSS 4, Prisma 7 with the `pg` adapter, PostgreSQL on Supabase, NextAuth v5 (credentials), Zod, react-hook-form, Vitest. Deployed on Vercel.

## Getting started

```bash
npm install          # also runs `prisma generate`
cp .env.example .env # then fill in the values below
npx prisma migrate deploy
npm run dev          # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
|---|---|
| `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_NAME` | Runtime database connection used by the app. On Vercel use the Supabase **transaction pooler** (IPv4) values. |
| `DATABASE_URL`, `DIRECT_URL` | Used by the Prisma CLI for migrations. |
| `AUTH_SECRET` | Secret used by NextAuth to sign sessions. |
| `AUTH_TRUST_HOST` | Set to `true` when running behind a proxy such as Vercel. |
| `CRON_SECRET` | Bearer token that protects `/api/cron/keep-alive`. |

### Creating the first super admin

There is no public signup. Create a user row and promote it manually, then sign in and create everyone else from the Admin console:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE username = 'your-username';
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests (Vitest). |
| `npx tsc --noEmit` | Type check. |

### Optional checks against a real database

```bash
# integration tests for the per-project schema layer (uses a throwaway schema)
RUN_DB_INTEGRATION=1 node --env-file=.env node_modules/vitest/vitest.mjs run src/lib/projectSchema.integration.test.ts

# end-to-end API and page checks against a running `next start`
node --env-file=.env scripts/e2e-issues.mjs http://localhost:3100

# remove any leftover e2e_* users/projects if a run was interrupted
node --env-file=.env scripts/e2e-cleanup.mjs
```

The end-to-end script creates temporary `e2e_*` users and a temporary project in the configured database and removes them when it finishes.

## How it is organised

```
src/app/(site)/        main site pages: /, /login, /dashboard, /admin, /change-password
src/app/[slug]/        a project's own area: /{slug}/board, /{slug}/board/{issueId}, /{slug}/settings
src/app/api/           route handlers (all wrapped in withApiErrorHandling)
src/lib/               permissions, validation (Zod), per-project schema access, rate limiting
src/components/        UI components
prisma/                schema and migrations (global tables)
scripts/               real-database E2E, cleanup and screenshot helpers
```

Each project gets its own Postgres schema (`proj_<uuid>`) holding `issues` and `comments`. Older project schemas upgrade themselves on first use (`ensureProjectSchema`).

## Deployment

Deploy to Vercel with the environment variables above. `vercel.json` schedules a daily call to `/api/cron/keep-alive` so the free Supabase database is not paused for inactivity.
