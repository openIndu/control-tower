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
