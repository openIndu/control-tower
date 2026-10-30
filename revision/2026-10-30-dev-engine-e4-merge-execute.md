---
date: 2026-10-30
slug: dev-engine-e4-merge-execute
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#36
---

# engine/merge-execute.mjs (spec/005 stage 6, PR-E4) — stage 6 complete

## Summary

Fourth and final sub-PR of spec/005 stage 6 (PR-E: implementation/PR/CI/merge orchestration). Covers merge
execution, post-merge readback, and the wiring that connects the existing stage-4 circuit-breaker and
rollback-detection functions into the merge path. With this PR merged, stage 6 is complete: E1
(worktree/git-ops, `#33`), E2 (run-state/resume/lock, `#34`), E3 (PR lifecycle, `#35`), E4 (this PR, `#36`).

## What this PR changes

- `plugins/openindu-control-tower/engine/merge-execute.mjs`:
  - `executeMerge`: `gh pr merge --squash --delete-branch --match-head-commit <sha>`. Per spec/005 section
    2.3-6, `--admin` is never in the argv — not filtered out, never added.
  - `readBackMergeState` / `verifyMergedTreeMatchesReviewed`: the two halves of "合并后读回（状态、合并提
    交、树与已评审 head 一致）" — state/mergeCommit from `gh pr view`, and a real `git diff --name-only`
    confirming the merged tree matches what was reviewed for the relevant paths.
  - `evaluateCircuitBreakerAfterMerge` / `checkForRollbackAndPause`: thin wiring over the existing stage-4
    `shouldTripCircuitBreaker`, `detectRevertOfRecordedMerge`, and `writePause` (all from `#26`) — no
    decision logic duplicated.

## `--admin` exclusion verified by breaking it

Temporarily added `--admin` into `executeMerge`'s argv, confirmed the corresponding test went red, then
reverted and confirmed all 9 pass again.

## Test result

9 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/merge-execute.test.mjs
# tests 9, pass 9, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Stage 6 status

All four sub-PRs merged. Stage 6's acceptance (spec/005 section 4: fake-`gh`-fixture coverage of CI-failure
retry cap, head change, default-branch-red, non-runner-merge triggers circuit breaker, mid-interruption +
`--resume` idempotency, excluded types rejected) is satisfied across E1–E4's 41 combined tests
(11 + 7 + 14 + 9); no end-to-end fixture harness tying all four modules together into one simulated run has
been built yet — that assembly happens in stage 7, when `skills/dev/scripts/dev.mjs` is written and can be
exercised as a whole.

## Next

Stage 7 (PR-F: `dev.local_service` execution + "not pointing at production" check, `./dev build`, `/dev`'s
own SKILL.md, two launchers) is next — it assembles the `engine/` library modules from stages 4–6 into the
actual callable `skills/dev/scripts/dev.mjs` entry point.
