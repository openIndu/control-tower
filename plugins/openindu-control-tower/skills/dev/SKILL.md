---
name: dev
description: Implement one accepted openIndu task against its product acceptance criteria on an isolated feature branch, then hand the exact source SHA to /test.
argument-hint: "<openIndu/repo> <task-id> [--dry-run]"
disable-model-invocation: true
---

> **Codex compatibility:** Invoke this workflow as `$dev` in Codex. Translate referenced Claude slash skills such as `/principle` to the corresponding Codex skill, such as `$principle`; Codex does not register `/...` commands.

# /dev — Implement one accepted task

Call `/principle` and `/route`; load the build role for the repository's actual
language/modules. REASON: choose the smallest correct implementation. EXECUTE:
inspect, edit, lint and commit. This entry has no backlog runner or carrier.

## Preconditions

Read AGENTS.md, CODEOWNERS, architecture and repository checks. Inspect status
before fetching; preserve existing changes and use an isolated worktree/feature
branch. Verify the remote belongs to openIndu. Read the task's exact product
artifact and acceptance IDs, not a shared latest report.

Run `skills/issue-pipeline/scripts/workflow-request.mjs <request.json>` under the
plugin root with `command: "dev"`, repo/task/run IDs, `checkpointFile`, the full
baseline `sourceSha` and boolean `dryRun`. Research/prod checkpoints and their
hashes must pass. Use `reference/workflow-execution.md` for the lease and state.
Dry-run returns a diff plan, target files and test commands; it makes no branch,
edits, commits, leases, checkpoints or remote writes.

## Implementation and handoff

1. Map each acceptance criterion to the smallest code/document change. Inspect
   existing implementations and reuse project conventions. Escalate security,
   device safety, data or cross-repo contract changes under `/principle`.
2. Implement on `feat/...`, `fix/...` or `chore/...`; keep RULE 4's review size
   boundary. Split by meaningful dependency when necessary.
3. Add appropriate regression tests, run targeted checks and local format/lint,
   and self-review correctness, security, maintainability and architecture.
4. Create a traceable local commit. Write `<task-dir>/dev-v<N>.md` with acceptance
   mapping, diff, source SHA, commands/results, review findings and unresolved
   risks. Record dev PASS through `workflow-state.mjs` with that full source SHA.
5. Hand `/test` the task identity, exact commit and acceptance matrix. Any code
   change after testing requires new dev/test checkpoints and invalidates builds.

This command stops at the development handoff. It does not enumerate Issues,
push or open a PR before testing, merge, build images, deploy, or grant standing
merge authority. `/dev_issue` owns backlog execution and tested PR creation;
`/pr_merge`, `/build` and `/publish` are separate stages.
