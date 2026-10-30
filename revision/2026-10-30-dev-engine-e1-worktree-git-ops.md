---
date: 2026-10-30
slug: dev-engine-e1-worktree-git-ops
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#33
---

# engine/worktree.mjs + engine/git-ops.mjs (spec/005 stage 6, PR-E1)

## Summary

First sub-PR of spec/005 stage 6 (PR-E: implementation/PR/CI/merge orchestration). Stage 6's full scope is
worktree management, commit+push, draft-first/promote-to-ready ordering, PR+CI polling, merge+readback, and
the circuit breaker. This PR covers the first module boundary only: local git plumbing.

## What this PR changes

- `plugins/openindu-control-tower/engine/worktree.mjs`: `createIssueWorktree`, `removeIssueWorktree`,
  `listWorktrees`, `issueWorktreePath`, `issueBranchName`. Per spec/005 section 2.1 step 3, each issue gets
  its own worktree and branch, isolated from the user's own checkout. Worktrees default under the OS temp
  dir, never inside the target repo and never inside `mem_docs` (which is reserved for solution/review
  documents, a separate concern).
- `plugins/openindu-control-tower/engine/git-ops.mjs`: `buildCommitMessage`, `commitChanges`, `pushBranch`,
  `currentCommitSha`. Attribution comes from `dev.commit.co_authored_by` (`dev.schema.json`'s existing
  field) — never a hardcoded trailer, never silently omitted. A repo with no `commit.co_authored_by`
  configured gets a plain message with no trailer, matching the schema's documented default.

## Why `execFileSync`, not a shell string

A commit message can carry agent-authored text (spec/005's own REASON-side output), so it must never be
interpolated into a shell command. Both modules call `git` via `execFileSync` with an argv array and an
injectable `execGit` parameter — the message travels as a single argv element, with no `/bin/sh` or
`cmd.exe` involved, so backticks/`$(...)` in it cannot be interpreted as commands. This is exercised
directly: one test commits a message containing both and confirms it lands verbatim in `git log`, not
partially executed.

## Test result

11 new tests, all run against real local git repositories/bare remotes created in a temp dir per test (the
"本地裸仓" fixture approach spec/005 section 4 names for this stage) — no mocking of git itself.

```
node --test plugins/openindu-control-tower/engine/worktree.test.mjs plugins/openindu-control-tower/engine/git-ops.test.mjs
# tests 11, pass 11, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/` is outside
`check-version-bump.mjs`'s `DISTRIBUTED_PREFIXES`, same as every prior stage-4/stage-5 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

E2 (run-state + resume + single-run-per-repo lock), E3 (PR lifecycle: draft→ready promotion, CI polling,
retry), and E4 (merge execution + readback + circuit-breaker/rollback-detection wiring to the existing
stage-4 modules) close out stage 6.
