---
name: prod
description: Turn a task's research evidence into a scoped product requirement, prioritized MVP and executable acceptance matrix for development and local testing.
argument-hint: "<openIndu/repo> <task-id> [--dry-run]"
disable-model-invocation: true
---

# /prod — Product definition

Call `/principle` and `/route`; load the product-manager role. REASON: clarify
the user outcome and choose scope. EXECUTE: validate inputs and version artifacts.

Run `skills/issue-pipeline/scripts/workflow-request.mjs <request.json>` under the
plugin root with `command: "prod"`, repo/task/run IDs, `checkpointFile` and
boolean `dryRun`. It must verify this task's research checkpoint and evidence
hash. Missing, rejected, changed or unrelated research blocks implementation.
Reuse the repository lease under `reference/workflow-execution.md`; do not steal
another run's lease. Dry-run returns questions and a proposed PRD outline only,
without leases, artifact/checkpoint writes, source edits or platform writes.

## Product artifact

Read the precise research report supplied by its checkpoint. Write a new
`<task-dir>/prod-v<N>.md` with:

- User, scenario, problem, desired outcome and research input path/hash.
- Existing capability and the delta; connect each selected differentiation action
  to a requirement or explain its deferral.
- MVP, priorities, scope/non-goals, dependencies, compatibility and risks.
- User stories and an acceptance matrix: stable criterion ID, expected result,
  automated test, local interactive verification, and evidence to retain.
- Success metric and experiment threshold, rollout/rollback constraints,
  unresolved blockers and the development/test handoff.

Use checkable Given/When/Then examples. Resolve ambiguity using repo evidence or
the user; never invent an answer to enter development. Architecture/UI roles may
advise on feasibility; they do not replace the product acceptance decision.

## Gate and handoff

Record prod PASS through `workflow-state.mjs` only with `blockers: []`, positive
`acceptanceCount`, reason and the new artifact. An evidenced applicability NA is
allowed for a routine fix; development and test remain mandatory. Changing this
stage invalidates downstream development/test/build evidence.

Pass `/dev` the exact task identity and PRD path/hash. Keep separate tasks in
separate directories and preserve completed versions. Report the scoped outcome,
acceptance criteria, blockers and next step; do not code, merge or publish here.
