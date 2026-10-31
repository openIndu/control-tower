---
date: 2026-10-31
slug: dev-engine-real-step4-deps
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#60
---

# F8-14: buildRealStep4Deps -- the real buildStep4Deps adapter

## Summary

`issue-pipeline.mjs`'s `runIssuePipeline` takes `buildStep4Deps` as an injected dependency and
calls it once per issue with `{worktreePath, branchName, issue, tier, scoping, declaredPaths,
solutionDocument, implementationReviewDocument}`. `step4-callbacks.mjs`'s `buildStep4Callbacks`
already does all the real orchestration work -- it just needs a `context` + `internalFacts`
object assembled correctly. This PR is that adapter.

## What this PR adds

New `engine/real-step4-deps.mjs`: `buildRealStep4Deps(runContext, issueArgs, overrides)`.

Every field-sourcing question raised by the F8-12/F8-13 research passes is now resolved:
`prTitle`/`prBodyFilePath` via `pr-content.mjs` written to `docsDir`; the tier/scoping/
declaredPaths-derived G4/G6 facts; `authorizedApprovers`/`repoName`/circuit-breaker facts passed
through from `runContext`; G10's facts read directly off the issue object's own snapshot-entry
fields (`issue.source`/`issue.bodyHashAtSnapshot`), needing no further changes to
`issue-pipeline.mjs` since `issue-intake.mjs`'s `buildSnapshotEntry` already spreads them onto the
raw issue.

Two design points: `reviewedSha`/`reviewedPatchId` are lazy + memoized (no step-4 commit exists
at construction time; memoization keeps the value fixed across a later CI-fix re-commit).
`ciEvaluatedSha` is deliberately left unsupplied -- `gatherMergeFacts`'s own fresh `prHeadSha` is
always equal to it by construction, and the patch-id-equivalence branch this module does source
never references it. `currentBodyHash` is, by contrast, a getter re-fetched fresh every call,
since G10 exists to catch a late body edit right up to merge time.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 447, pass 447, fail 0
```

10 new tests. Mutation checked: removing the `reviewedSha`/`reviewedPatchId` memoization turned
exactly 1 predicted test red; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed).

## Impact

| Scope           | Note                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| Behavior change | Additive only -- new adapter module                                    |
| Blast radius    | `openIndu/control-tower` only; not wired into any live entry point yet |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only                                 |
| Rollback        | New files -- revert the PR                                             |

## Next

`main()`'s per-repo loop is next: CLI dispatch, `--max-issues`/`--max-total-budget-usd` (F8-9's
budget tracker), trace logging (F8-11's `withTraceLogging`), `stopAfterCiGreen` resolution (via
`route-reader.mjs`'s `resolveRepoAuthorization`), run-state persistence/lock/resume
(`run-state.mjs`), circuit-breaker counter tracking across loop iterations, `--dry-run` handling,
repo cloning (`worktree.mjs`'s `ensureRepoClone`), step 5/6 sequencing, the final acceptance-matrix
report (criterion #15) and degradation/human-correction/rollback rates (criterion #16, via
`run-report.mjs`), and exit code selection. This is the piece that will actually construct
`runContext` (resolving `authorizedApprovers` once per repo, reading `dev.commit`/
`dev.publishes_on_merge` from route.json) and pass `buildRealStep4Deps` as `issue-pipeline.mjs`'s
`buildStep4Deps`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
