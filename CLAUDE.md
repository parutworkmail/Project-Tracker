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

## Git push: manual only, by the user — RULE ZERO FOR PUSH, READ BEFORE ANY `git push` (no exceptions)
This rule has already been violated once (bundling push into an
`ask_user` option). It is being restated in the strongest possible terms
because "I forgot" or "I inferred consent" is not acceptable here.

1. **Default state: push is FORBIDDEN.** Every single session, every
   single task, starts with push forbidden. There is no standing
   permission, no memory of a past session's "yes", no carry-over.
2. **The ONLY thing that lifts the ban**: the user's CURRENT message, in
   plain text, contains an unambiguous, dedicated instruction to push —
   e.g. "push", "push it", "yes push now". That instruction must be
   about pushing specifically, not buried inside a bundled option like
   "validate + commit + push" in an `ask_user` menu, not inferred from
   "looks done", not inferred from "ship it" / "wrap up" / "finish this"
   alone (ask explicitly if those are ambiguous about push vs. just
   commit).
3. **One instruction = ONE push, exactly once.** The moment `git push`
   succeeds, the permission is immediately and fully consumed. Do NOT:
   - push again later in the same session without a brand new explicit
     instruction, even if more commits pile up afterward
   - push multiple pending commits across several topics as if one
     "push" covers all of them going forward
   - treat "push" as toggling some ongoing mode — it authorizes exactly
     one `git push` invocation, immediately, for what's committed right
     now, then reverts to forbidden.
4. **Never offer push as a bundled choice.** Any `ask_user` call,
   multi-step plan, or internal checklist must NEVER include "push" as
   part of a combined option (e.g. "validate+commit+push",
   "test and ship"). Validate and commit, then STOP. If uncertain
   whether the user wants a push, ask ONLY about the push, as its own
   separate, single-purpose question — never pre-select it, never phrase
   it so a generic "yes" could be read as covering it.
5. **After any push**, explicitly state in your reply that you pushed and
   what was pushed. Never push silently.
6. **If genuinely unsure whether the current message authorizes a push**:
   treat it as NOT authorized. Commit locally, tell the user their branch
   is ready, and stop. Under-asking is always safe here; over-pushing is
   the failure mode this rule exists to prevent.

## Validation tiers: light while developing, full only before a push (standing rule)
Full tsc + lint + build + full test suite + an agent validator pass on
every small step is too slow and wasteful — this was flagged as a real
workflow problem. Use two tiers instead:

1. **While developing/iterating on a feature** (the normal case): after
   each file change, only run a FAST, TARGETED syntax/type check —
   `npx tsc --noEmit` is fine (it's quick), but do NOT run `npm run
   build`, do NOT run the full `npm test` suite, and do NOT spin up an
   `agent` validator sub-agent after every step. If you want quick
   confidence on the specific thing you just touched, run only the
   relevant test file(s) (e.g. `npx vitest run path/to/thing.test.ts`),
   not the whole suite.
2. **Full validation pass** — `npx tsc --noEmit` + `npm run lint` +
   `npm run build` + full `npm test` + (optional) one `agent` validator
   pass — is reserved for:
   - right before the user is about to `git push` (i.e. when wrapping
     up a feature and handing it off), or
   - whenever the user explicitly asks for "full validation"/"make sure
     everything works"/equivalent.
   Do not self-trigger a full sweep just because a step "feels done" —
   wait for one of the two triggers above, or ask if genuinely unsure
   which tier applies.

This supersedes the per-phase "runs tsc/lint/build itself" language in
the Team Workflow below and rule 4 under Rules — those describe the
FULL-validation tier, not something to repeat after every small edit.

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

## Feedback queue (standing rule)
The user leaves feedback in `FEEDBACK.md` (Inbox section). After finishing
every task, re-read it, handle new items next (before the roadmap), and
move handled items to Done. Post a short "ready to test" chat message
(what to click) when a feature is verified, then keep working.

## Daily summary = infographic (standing rule)
**Use the `daily-summary-infographic` skill** (`.axet-code/skills/daily-summary-infographic/SKILL.md`)
for this - it has the fast step-by-step, the approved template, and the
facts/render scripts (`scripts/summary-facts.mjs`, `scripts/render-html.mjs`).
Summary of the rule:
When the user asks for a summary of the day / "what have you done and what
is left", do NOT answer with a long text list. Gather everything from
`PROGRESS.md`, git status and the day's test results, then produce an
infographic: write `docs/summaries/YYYY-MM-DD-summary.html`, render it to
`docs/summaries/YYYY-MM-DD-summary.png` with `node scripts/render-html.mjs`,
view the PNG to check it, then OPEN IT FOR THE USER in their default image
viewer (never leave that to them): run
`powershell -NoProfile -Command "Start-Process -FilePath '<absolute png path>'"`.
Finish with the file path plus a 2-3 line text recap.

Accuracy rules for the infographic (a wrong number here already cost the
user's trust once — "Real-database tests 6/6" was run on a local throwaway
DB, not the real one):
- Every figure must come from a command run or a file read in THIS session
  (git status -uall for file counts, test output for pass counts, the
  actual number of agents spawned, findings fixed vs left open). Never
  round up, never reuse an earlier recap's number without re-checking.
- Every check that touches a database MUST name which one ("local test
  Postgres" vs "the user's Supabase"). Only the user's Supabase may be
  called "real". If the final code was never run on Supabase, say so in
  red on the page.
- Never write "all fixed" / "all passing" unless true; show X/Y and list
  what is left open.
- If the PNG is locked because the viewer has it open, render to a new
  `-v2.png` name instead of failing. Always include: what was done, verification numbers, what is
NOT done / blocked, what was never built, and what the user must do.

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
