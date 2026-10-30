---
date: 2026-10-30
slug: dev-engine-f8-8-issue-pipeline
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#51
---

# engine/issue-pipeline.mjs: runIssuePipeline (spec/005 stage 7, PR-F8-8)

## Summary

Eighth of stage 7's final sub-PRs (F8). Ties together everything stage 6 (E1-E4) and stage 7's F1-F7
built into the complete per-issue pipeline: worktree creation, tier resolution, and steps 2-4, for one
issue. This is the first sub-PR where these previously-separate modules are actually wired together
end to end, and that integration test immediately surfaced a real bug in an already-merged module.

## What this PR changes

`plugins/openindu-control-tower/engine/issue-pipeline.mjs` (new): `runIssuePipeline(issue, context,
deps)`. Sequence: create worktree -> resolve tier (F8-3's `resolveTier`) -> step 2 (F3's `runStep2`) ->
step 3 (F4's `runStep3`) -> step 4 (F5's `runStep4`). `run-state.mjs`'s per-issue shape only tracks step
4's progress (`{openedPr, prNumber, promotedToReady, merged, ...}` — no "step 2/3 done" flag), so on
`--resume` with `resumeIssueState.openedPr` already true, this function skips worktree creation and
tier/step2/step3 entirely and goes straight to step 4 with the existing worktree path — re-running them
would re-invoke agents pointlessly and try to `git worktree add` a path that already exists.

**Bug found and fixed**: `implement-review.mjs`'s `runLocalGates`/`defaultExecShell` (merged in F4,
`#40`) never threaded a `cwd` through — local gate commands (`route.json`'s `dev.checks`) would run in
the runner process's own working directory, not the issue's worktree. No single module's own unit
tests caught this (they all inject a fake `execShell` that ignores cwd); it only surfaced once
`issue-pipeline.test.mjs`'s happy-path test ran `runStep3` for real inside this repo's own working
tree and the gate command failed for the wrong reason. Fixed by appending `cwd` as a trailing, optional
third parameter to `runLocalGates` (so every pre-existing call keeps working unchanged) and threading
`worktreePath` through `runStep3` to it.

`pr-and-merge.mjs`'s `runStep4` gains `stopAfterCiGreen` (spec/005 section 2.1's `--no-merge` control
switch): once CI turns green, return `{outcome: "PR_GREEN"}` immediately, never touching
promotion/merge. A resumed run where the issue was already merged under an earlier invocation that did
not pass `--no-merge` still finishes through to `MERGED` — `stopAfterCiGreen` only short-circuits the
not-yet-merged path.

## Test result

69 tests across the three touched/added files (4 new in `issue-pipeline.test.mjs`, 2 new in
`pr-and-merge.test.mjs` for `stopAfterCiGreen`). Full `engine/` suite:

```
node --test "plugins/openindu-control-tower/engine/*.test.mjs"
# tests 357, pass 357, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only, not yet wired into any
SKILL.md-reachable entry point).

Mutation checks performed and reverted:

1. `runStep4`'s `stopAfterCiGreen && !resumeState.merged` guard, relaxed to `stopAfterCiGreen` alone —
   the already-merged-resume test went red (wrongly returned `PR_GREEN` instead of finishing to
   `MERGED`); reverted.
2. `runStep3`'s `runLocalGates(localGateCommands, execShell, worktreePath)` call, reverted to omit
   `worktreePath` — the new cwd-threading assertion in `issue-pipeline.test.mjs`'s happy-path test went
   red; reverted.

## Impact

| Scope           | Note                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | New: `issue-pipeline.mjs`. Fixed: local-gate `cwd` (real bug, not yet reachable from any entry point). Extended: `runStep4`'s `stopAfterCiGreen` (opt-in, default `false`, no behavior change for existing callers) |
| Blast radius    | `openIndu/control-tower` only                                                                                                                                                                                       |
| Plugin version  | Unchanged (`5.19.0`)                                                                                                                                                                                                |
| Rollback        | Revert the PR — `issue-pipeline.mjs` is new and unreferenced elsewhere; the `cwd`/`stopAfterCiGreen` parameters are both additive and default-compatible                                                            |

## Next

What remains of stage 7's final assembly: `dev.mjs`'s `main()` — CLI dispatch (the main per-repo run
vs. the separate `./dev build <repo>` and `./dev ack <run-id>` subcommands), the issue loop calling
`runIssuePipeline` with real dependencies while respecting `--max-issues`/`--max-total-budget-usd`/the
circuit breaker, run-state persistence/lock/resume, step 5/6 after the loop, final report formatting,
and exit-code selection — plus the `SKILL.md` and launcher templates. Given the ≤400-line-per-PR
convention this plan has followed throughout, this is likely one more sub-PR (`main()` wiring) plus a
closing sub-PR for `SKILL.md`/launchers and the full stage-7 acceptance sweep against spec/005 §6's
20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
