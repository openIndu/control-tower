---
name: test
description: Run unit and integration tests for an exact source SHA, manually start the local environment, perform interactive acceptance verification, retain evidence and clean up.
argument-hint: "<openIndu/repo> <task-id> [--dry-run]"
disable-model-invocation: true
---

# /test — Automated checks and local interactive verification

Call `/principle` and `/route`; load the test role and the task's precise PRD/dev
artifacts. REASON: map risk and acceptance criteria to checks. EXECUTE: run tests,
start the environment, interact with it, capture results and clean up.

## Mode dispatch

- `/test <openIndu/repo> <task-id> [--dry-run]` — full pipeline mode (the rest of
  this file): lease, checkpoints, evidence per acceptance ID.
- `/test <project>` with no task id — **lightweight mode** (see "Lightweight mode"
  at the end): start that project's verified local test stack, hand the session to
  the owner for manual testing, locate + file issues for findings. Writes no
  leases, checkpoints or workflow state.

## Pipeline mode

Run `skills/issue-pipeline/scripts/workflow-request.mjs <request.json>` under the
plugin root with `command: "test"`, repo/task/run IDs, `checkpointFile`, exact
development `sourceSha` and boolean `dryRun`. Check that the tested checkout
really has that SHA and is clean. Follow `reference/workflow-execution.md`.
Dry-run reports test/startup/interaction/cleanup commands and acceptance coverage;
it starts no process and writes no leases, artifacts, checkpoints or remote state.

## Required verification

1. Run repository-required lint/format, UT and IT plus relevant regression/security
   checks. Retain exact commands, environment, exit codes, duration and logs.
2. Inspect local configuration without exposing credentials. Refuse production
   endpoints or physical-device interaction without the required authorization.
   Start the real local service/app explicitly; record command, PID, ports and
   readiness/health response. Do not assume an already running process matches
   the tested SHA. On Windows, background helpers use hidden windows.
3. Perform the PRD's interactive/manual scenarios in the running local UI, API,
   CLI or simulator. Exercise changed behavior, an error path and regression
   cases. Retain screenshots, requests/responses or terminal evidence per
   acceptance ID. Automated unit tests do not establish manual verification.
4. Stop only processes/resources started by this task, record cleanup, and
   confirm the source did not change. Re-run affected checks if it did.

Write `<task-dir>/test-v<N>.md` with expected/actual/pass/fail per criterion,
tested SHA, logs and interactive evidence. Missing dependencies, inaccessible
local environment, unavailable interaction tools or unverified criteria mean
BLOCKED, never a fabricated PASS. For non-server changes choose task-appropriate
integration and local interactive checks and explain their coverage.

## Checkpoint and handoff

Record test PASS through `workflow-state.mjs` only for the same dev SHA and with
`checks` containing `UT`, `IT`, `LOCAL`, `MANUAL`, `CLEANUP`, each with PASS and
nonempty evidence. Test cannot be NA. Report failures and next actions exactly.
The tested SHA/report feed PR creation and `/build`; source changes invalidate
that evidence. This command does not merge, publish or use production as a test.

## Lightweight mode — `/test <project>`

For ad-hoc verification loops outside the issue pipeline: start the project's
verified local test stack, hand the session to the owner for interactive testing,
then locate + file issues for every finding. Writes no leases, checkpoints or
workflow state. Call `/principle` first (same RULE scope: no production
endpoints, no device interaction without authorization).

Dispatch table — verified start harnesses only; add a row only after its
commands have been run successfully end-to-end:

| project (route.json id) | start + verify | interactive surface | issues |
| --- | --- | --- | --- |
| openindu/openindu-website | `powershell -File mem_script/start-local-test.ps1 -MonorepoBranch main` on the workstation (Docker Desktop required; ~5–10 min; script gates dirty checkouts, self-heals Milvus, seeds data, prints an acceptance matrix) | Portal `localhost:3000` / Admin `localhost:3001` (login `13800000000` / code `888888`; suppliers `13800000003/4`) / MCP `localhost:8005/mcp/sse` | openIndu/openindu-website |
| openindu/openindu-scan | `dotnet build OpenIndu.Scan.sln` → `dotnet test` (49 tests) → `dotnet run --project OpenIndu.Scan` (WinForms window; verify the process via tasklist — `| head` pipes kill GUI apps) | desktop forms: Login → Dashboard workbench → scan sessions (NG path) → Records → Settings → user management → Diagnostics | openIndu/openindu-scan |

Flow:

1. Start per the table and read back health signals (script acceptance matrix /
   test count / process alive). Git health first: an orphaned worktree or dirty
   checkout is reported to the owner before anything is built.
2. Hand the owner a testing card: entry points, accounts, record format
   (form/page + symptom + expectation).
3. For each finding: dual-evidence locate (code grep + stack read-back), dedupe
   against open issues, then file (background facts with file:line anchors /
   behavior-level requirement / programmable acceptance incl. no-collateral
   clauses / deploy context / non-goals). Locate and file — never fix inline.
