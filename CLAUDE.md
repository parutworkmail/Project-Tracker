# CLAUDE.md — Project Tracker Site

## Quick facts
- **Live deployed site**: https://project-tracker-virid-eight.vercel.app
  — if the user asks to "open the site", this is the URL (note: this
  agent has no browser-automation tool, so it can't literally open
  Chrome; use `fetch`/`agentic_fetch` to check the site instead and
  tell the user to open it themselves, or give them the link to click).
- **GitHub repo**: https://github.com/parutworkmail/Project-Tracker.git
  (origin remote, forked from the original to the user's personal
  account — see PROGRESS.md "Session: repo ownership transfer").

## Git push: manual only, by the user (standing rule)
User pushes to `origin` themselves from now on. Do NOT run `git push`
unless the user explicitly asks for it in that specific message — a
past "yes, push" does not carry forward to later tasks or sessions.
Commit locally as normal; just stop before the push and tell the user
their local `main` is ready to push.

## RULE ZERO — LOG BEFORE YOU TOUCH ANYTHING (no exceptions, read this first, every message)
This has been violated before by treating it as optional for "small" or
"obviously what the user asked for" actions. It is NOT optional and there
is NO exception for quick/obvious/small/user-explicitly-said-so requests.

**Before the FIRST bash/edit/write/multiedit call of ANY new user request**
(even a one-line request like "mark user X as super admin" or "run this
query"), you MUST first write a `### Live Task Log` entry at the top of
`PROGRESS.md` stating, in the user's own intent:
- **Plan**: "User wants me to <exactly what they asked, in their terms>."
- **Status**: `in progress`.

Only AFTER that PROGRESS.md edit has actually been made do you call any
other tool. If you catch yourself about to run bash/edit/write/multiedit
and there is no fresh `in progress` log entry for this exact request yet
— STOP, write the log entry first, then proceed.

When the request is finished, update that same entry: **Status**: `done`
(or `failed`/`blocked`) + result in 1-2 lines, and **Next**: what's next.

This is rule zero because every other rule/workflow in this file assumes
it already happened — crash recovery, the Team Workflow, the timeout
protocol all depend on the log being written first. Full mechanics of
what goes in the log and how it's trimmed/folded over time are in
"Crash-Safe Task Logging" below — but the ONE non-negotiable part is:
log BEFORE, not after, with no exceptions for how small the ask looks.

## Session Start
Read `PROGRESS.md` first — it tracks what's done, known loose ends, and next
steps across sessions. Update it after each meaningful change.

## Crash-Safe Task Logging (log BEFORE acting, not after — read every session)
A session can crash mid-task with zero warning. Logging only at the end of a
session is not good enough — if the crash happens mid-task, nothing was ever
written down and the next session can't tell what was left mid-flight. So:

1. Before starting ANY task/step — including ones that look trivial, are
   one line long, or are a direct literal instruction from the user — first
   write/update a `### Live Task Log` section at the TOP of `PROGRESS.md`
   with:
   - **Plan**: what I'm about to do, in 1-3 lines.
   - **Status**: `in progress`.
2. Only after that log entry is written, actually execute the step.
3. Immediately when the step finishes (success or failure), update the SAME
   entry:
   - **Status**: `done` / `failed` / `blocked`, plus the result in 1-2 lines.
   - **Next**: what happens next (next step, or "none — task complete").
4. Keep only the most recent 1-3 entries in `### Live Task Log` (it's a
   scratchpad for crash recovery, not a permanent history) — once a whole
   user-level task is finished and verified, fold the summary into the
   normal dated `## Session: ...` sections below it and clear the live log
   back to a single "idle" line.
5. On resuming any session (including after a crash), read `### Live Task
   Log` FIRST, before anything else — if it shows an `in progress` entry,
   that's exactly where the last session died; verify current repo state
   (git status/diff, test run) against that entry before continuing.

This applies on top of (not instead of) the existing end-of-change
`PROGRESS.md` updates and the Agent Timeout rule below.

## Rules

1. If unsure or have any question, ASK FIRST until fully understood before acting.
2. Do only what is asked. If there's a suggestion, mention it separately — do NOT implement it in the same command.
3. Minimal comments. Developer-level code, no over-explaining simple things.
4. After each change/step, use a second agent (Agent tool) to independently verify correctness before moving on.

## Next.js Notice
This project's Next.js version has breaking changes vs older training data —
APIs, conventions, file structure may differ. Check `node_modules/next/dist/docs/`
before writing Next.js code. Heed deprecation notices.

## Team Workflow (persists across sessions/crashes — read this every session)
User wants work simulated as 4 roles. Real constraint: only the main session
has edit/write/bash; the `agent` tool sub-agents are read-only (search/view/grep
only, no file writes, no command execution). So sub-agents act as VALIDATORS,
not independent coders. Work accordingly:

1. **Team Lead** (main session) — talks to user, writes the spec (exact
   request/response contract) before coding, is the only one who actually
   edits files or runs commands: codes backend first, then frontend against
   the real backend. Runs `npx tsc --noEmit` / `npm run lint` / `npm run build`
   itself. Reports status to user after each phase.
2. **FE Validator** (`agent` sub-agent) — after frontend code is written:
   checks syntax/correctness, component/hook usage, confirms it calls the
   right endpoint with the right request shape, confirms UI logic matches
   requirements. Read-only review, reports findings back.
3. **Backend Validator** (`agent` sub-agent) — after backend code is written:
   checks syntax/correctness, route/schema correctness, business logic
   matches requirements, edge cases (Zod validation, auth checks, etc.).
   Read-only review, reports findings back.
   → FE Validator and Backend Validator run IN PARALLEL once both pieces of
     code exist (send both `agent` calls in one message).
4. **End-to-End Validator** (`agent` sub-agent) — runs AFTER both FE and
   Backend validators finish (needs both done to cross-check). Confirms FE
   request shape vs BE expected shape match, BE response shape vs what FE
   reads match, and the full user flow makes sense end to end.
5. Team Lead fixes anything flagged, re-runs tsc/lint/build as needed, then
   reports a consolidated summary to the user.

This is "1 real coder + up to 4 read-only validator sub-agents used in
sequence/pairs" — not literally independent coding agents. Be upfront about
that if asked.

## Agent Timeout / Runaway Protection
Any single `agent` sub-agent call (or any bash command/background job) that
runs longer than 5 minutes without resolving (no response, stuck
waiting/looping, excessive token use) must NOT be left running silently:
1. Stop waiting passively — surface it immediately to the user via `ask_user`:
   "Task X has been running >5 min without finishing, still want to wait?"
2. If user says No (or dismisses) → terminate that specific task only
   (e.g. `job_kill` for background shells; for `agent` tool calls there's no
   kill, so just stop waiting on/using that result and move on) — do NOT
   kill unrelated parallel tasks.
3. Log the termination in `PROGRESS.md` under a `### Incomplete / Terminated
   Tasks` section: what the task was, which role, why it was terminated,
   timestamp. Keep other finished work from that batch — don't discard
   results that already completed.
4. Continue with the rest of the workflow using whatever did complete; tell
   the user what's still outstanding because of the terminated task.
