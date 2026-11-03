---
name: pr_merge
description: Check and merge eligible PRs in one explicitly selected openIndu repository, with current-head approval, required CI, serial refresh and authoritative read-back.
argument-hint: "<openIndu/repo> [--dry-run]"
disable-model-invocation: true
---

> **Codex compatibility:** Invoke this workflow as `$pr_merge` in Codex. Translate referenced Claude slash skills such as `/principle` to the corresponding Codex skill, such as `$principle`; Codex does not register `/...` commands.

# /pr_merge — Repository PR merge queue

Call `/principle` first. REASON: classify dependencies and risk. EXECUTE: use the
bundled read-only gate and platform commands. Operate only on an explicit
`openIndu/<repo>`; reject other owners before any write. Never use admin bypass.

## Snapshot and authorization

`--dry-run` stops after read-only snapshot and eligibility checks. It never
acquires/releases a persistent lease, writes state/journals, or invokes merge.
Return the proposed queue and blockers to the user only.

Use `gh pr list --repo <repo> --state open --limit 1000 --json number,url,headRefOid,baseRefName`
and paginated API reads if the result reaches the limit. Record every PR, including
drafts, blocked items and dependency order. Present intent, affected PRs, merge
method, rollback by revert PR, and required human authorization. Existing explicit
authorization persists; it does not replace current-head human review or CI.

Acquire the repository lease using `issue-pipeline/scripts/workflow-state.mjs`
as described in `reference/workflow-execution.md`. Persist the snapshot and a
per-PR merge journal before writes; resume by querying GitHub, never replaying a
merge command from the journal alone. This workflow does not delegate merge authority.

## Process serially

1. Read the PR's current full head/base SHA. Run:

   ```text
   node <plugin-root>/skills/pr_merge/scripts/check-merge.mjs <repo> <number> <head-sha> <base-sha>
   ```

   Exit 0 means eligible at inspection time. Exit 2 means blocked. API errors,
   unknown merge state, no required checks, skipped checks, outstanding change
   requests, missing independent human approval of the current head, and changed
   head/base all block the write. Record the exact error and continue independent PRs.

2. Write a pending journal entry with PR, head/base, gate output, authorization
   reference and timestamp. Immediately rerun the gate. If evidence changed, stop
   this item and refresh. Merge only with:

   ```text
   gh pr merge <number> --repo <repo> --squash --match-head-commit <head-sha>
   ```

   Never use `--admin`, disable protection, or substitute auto-merge for read-back.
   Server-side branch protection must require checks against the current base
   (strict status checks or a merge queue). If that protection cannot be verified,
   stop: client checks alone cannot close the base-change race.

3. Regardless of command success/error, read `state,mergedAt,mergeCommit,headRefOid`
   back from GitHub. Mark MERGED only for the expected head and a non-null merge
   commit/time. Otherwise retain PENDING/BLOCKED; inspect before any retry.
4. After every merge, refresh all remaining PRs, dependency order and required CI
   against the new base. Do not reuse another PR's earlier green snapshot.

## Report

Report every snapshotted PR with expected head, actual head, required CI, review,
merge SHA/time and MERGED/BLOCKED/PENDING. Newly arriving PRs belong to a new
snapshot. Release the lease only after persisting read-back results. A partial
queue is partially complete; merged code is not evidence of production delivery.
