---
date: 2026-10-30
slug: dev-engine-f8-6-step4-callbacks
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#49
---

# engine/step4-callbacks.mjs (spec/005 stage 7, PR-F8-6)

## Summary

Sixth of stage 7's final sub-PRs (F8). `runStep4` (F5, `#41`) needs 11 injected callbacks. Most of the
underlying gh/git actions are already real (stage 6); this PR adapts their shapes to `runStep4`'s
contract, adds `attemptCiFix`, and completes the circuit-breaker/rollback fact-gathering split.

## What this PR changes

`plugins/openindu-control-tower/engine/step4-callbacks.mjs`: `buildStep4Callbacks(context,
internalFacts, deps)`. Thin adapters for commit/push/open-PR/poll/promote/merge/readback over stage-6's
real functions; `attemptCiFix` reuses F8-5's `buildRealFix` with a new `"ci-failure"` shape;
`gatherPromotionFacts`/`gatherPostPromotionFacts` delegate to F8-4's `gatherMergeFacts`;
`gatherCircuitBreakerFacts`/`gatherRollbackFacts` split fresh-read facts (default-branch CI conclusion,
merged-by identity check, default-branch commit log) from run-history facts the caller's run-state
tracking supplies.

`git-ops.mjs`: added `stageAllChanges`. `carrier-callbacks.mjs`: added a `"ci-failure"` case to
`formatFailureDescription`.

## Test result

69 tests, all passing, including two mutation checks (the `nonRunnerMergeDetected` comparison, and a
real-git-repo check for `stageAllChanges`).

```
node --test plugins/openindu-control-tower/engine/step4-callbacks.test.mjs plugins/openindu-control-tower/engine/git-ops.test.mjs plugins/openindu-control-tower/engine/carrier-callbacks.test.mjs
# tests 69, pass 69, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| Behavior change | None — new file plus additive extensions, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                                                |
| Plugin version  | Unchanged (`5.19.0`)                                                         |
| Rollback        | Revert the PR (additive only)                                                |

## Next

Step 5/6's real wiring, then the final assembly sub-PR.
