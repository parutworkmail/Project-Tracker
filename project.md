# Project Tracker Site

## Overview
A JIRA-like project tracker. Every project has its own shareable URL
(`/{slug}`), is used by multiple people across devices, and requires a real
user account. Accounts are created by a super admin; there is no public
signup.

## Requirements
- Full user accounts (username and password), created by an administrator.
- Cloud hosted — accessible from anywhere, not just the local network.
- Multiple projects, each with its own members and its own tasks.
- 1 Supabase Postgres database total; each project gets its own schema
  within it (not a separate database).

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js 16 (App Router) + TypeScript |
| Database | PostgreSQL |
| Database hosting | Supabase (free tier) |
| ORM / data access | Prisma 7 (global tables) and raw parameterized SQL (per-project schemas) |
| Auth | NextAuth v5, credentials (username + password) |
| Validation | Zod |
| Forms | react-hook-form + @hookform/resolvers |
| Styling | Tailwind CSS 4 (light, dark and system themes) |
| Tests | Vitest |
| App hosting | Vercel (free tier) |

## Roles
- **SUPER_ADMIN** — everything: creates users and projects, edits users,
  resets passwords, assigns project admins.
- **ADMIN** — manages only the projects a super admin assigned them to.
- **USER** — joins projects and works on tasks.

## Keep-Alive
Daily Vercel Cron Job (`vercel.json`) hits an API route that runs a trivial
DB query, preventing Supabase's 7-day inactivity auto-pause.

## Further reading
- `README.md` — setup, scripts, environment variables.
- `docs/FEATURES.md` — what the app can and cannot do.
- `PROGRESS.md` — engineering history and current status.
