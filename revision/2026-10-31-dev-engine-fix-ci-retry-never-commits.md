---
date: 2026-10-31
slug: dev-engine-fix-ci-retry-never-commits
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#59
---

# Fix: a CI-fix retry round never actually committed or pushed

## Summary

Found while tracing `pr-lifecycle.mjs`'s `runCiRetryLoop` before designing `buildStep4Deps`.
Confirmed a real, already-merged bug -- same class as the `ANTHROPIC_API_KEY` gap from #56: an
orchestration wire that looks complete but silently does nothing. As merged, the entire CI-fix
retry mechanism was inert.

## What this PR changes

`step4-callbacks.mjs`'s `attemptCiFix` called `fix()` (`buildRealFix`) and returned.
`buildRealFix`'s own prompt explicitly tells the carrier "Do not run any git commit or git push"
-- the same "implement only writes files" rule the main implement role already follows. Nothing
else in the retry path commits or pushes either: `commitAndPush()` runs exactly once, before the
PR is even opened; `runCiRetryLoop` itself only polls and calls `attemptFix`, no git operations.

A real CI-fix round therefore edited files and left them uncommitted. The next `checkCi()` call
polled the same, unfixed PR head, found the same failure, and repeated until `maxAttempts`
exhausted -- every fix attempt a complete no-op.

Fix: `attemptCiFix` now stages, commits (a dedicated `"fix: address CI failure (attempt N)"`
subject, reusing the issue's commit attribution/signoff settings), and pushes after `fix()`
completes -- guarded on a new `hasStagedChangesFn` check, so a fix role that genuinely finds
nothing to change lets CI re-poll the unchanged head and exhaust its retry budget, instead of
crashing on "nothing to commit".

New `engine/git-ops.mjs`: `hasStagedChanges(worktreePath, execGit)` uses `git status --porcelain`
(always exits 0) rather than `git diff --cached --quiet` (exit 1 when there IS a staged diff),
deliberately avoiding throw-based control flow for a normal outcome.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 437, pass 437, fail 0
```

1 new test in `git-ops.test.mjs`, 2 new in `step4-callbacks.test.mjs`. Mutation checked: removed
the commit/push block entirely, confirmed exactly 1 predicted test went red; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed).

## Impact

| Scope           | Note                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| Behavior change | Fix: a CI-fix round now actually lands on the PR branch                        |
| Blast radius    | `openIndu/control-tower` only; nothing live calls this path yet                |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only                                         |
| Rollback        | Revert the PR -- restores the (inert) prior state, not a regression either way |

## Next

With this fixed, G1's `reviewedSha`/`ciEvaluatedSha` design is confirmed: `reviewedSha` is
captured once (via `git-ops.mjs`'s `currentCommitSha`) right after the first `commitAndPush()`;
`reviewedPatchId` can reuse `merge-facts.mjs`'s already-exported `defaultComputePatchId` at the
same moment (a correction to an earlier research note -- this function already exists, so
`reviewedPatchId` is not a true gap); `ciEvaluatedSha`/`currentPatchId` are both freshly re-read
by `gatherMergeFacts` itself by the time any CI-fix round has actually landed a new commit. The
real `buildStep4Deps` module -- now unblocked on every field-sourcing question -- is next.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
