# CLAUDE.md — Project Tracker Site

## Session Start
Read `PROGRESS.md` first — it tracks what's done, known loose ends, and next
steps across sessions. Update it after each meaningful change.

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
