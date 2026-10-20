# Project Tracker Site

## Overview
A JIRA-like project tracker. Each project created on the site gets its own
shareable link, accessible by multiple users across multiple devices, with
full user accounts.

## Requirements
- Full user accounts (login/signup), not just link-based access.
- Cloud hosted — accessible from anywhere, not just local network.
- Multiple projects, each with its own users/members.
- 1 Supabase Postgres database total; each project gets its own schema
  within it (not a separate database).

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend + Backend | Next.js (App Router) + TypeScript |
| Database | PostgreSQL |
| Database hosting | Supabase (free tier) |
| ORM | Prisma |
| Auth | NextAuth |
| Validation | Zod |
| Forms | react-hook-form + @hookform/resolvers |
| Styling | Tailwind CSS |
| App hosting | Vercel (free tier) |

## Keep-Alive
Daily Vercel Cron Job (`vercel.json`) hits an API route that runs a trivial
DB query, preventing Supabase's 7-day inactivity auto-pause.
