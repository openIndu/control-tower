---
date: 2026-10-30
slug: dev-engine-f5-pr-and-merge
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#41
---

# engine/pr-and-merge.mjs (spec/005 stage 7, PR-F5)

## Summary

Fifth sub-PR of spec/005 stage 7 (PR-F), and the most central integration piece in the `/dev` pipeline so
far. Covers step 4's complete sequence: commit+push, open draft PR, CI with up to 2 fix retries,
pre-promotion guards, promote to ready, post-promotion recheck, merge, readback, circuit-breaker/rollback
checks.

## What this PR changes

- `plugins/openindu-control-tower/engine/pr-and-merge.mjs`: `runStep4`. Calls the existing
  `evaluatePromotionReadiness`/`evaluatePostPromotionRecheck`/`runCiRetryLoop` (E3, `#35`) and
  `evaluateCircuitBreakerAfterMerge`/`checkForRollbackAndPause` (E4, `#36`) directly — no decision logic
  duplicated. Every side-effecting action and fact-gathering call is injected; this module owns only the
  sequence and the outcome decision tree.

## Resume idempotency

`resumeState` (shaped like `run-state.mjs`'s per-issue entry) makes each step idempotent for `--resume`. A
step already recorded as done is skipped. This module does not import `run-state.mjs` or persist anything
itself — the caller applies the returned outcome and saves it.

## Test result

8 tests, all passing, including one that exercises a real `.dev-pause` file write when the circuit breaker
trips (not just the return value).

```
node --test plugins/openindu-control-tower/engine/pr-and-merge.test.mjs
# tests 8, pass 8, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6/7 PR).

## Impact

| Scope           | Note                                                     |
| --------------- | -------------------------------------------------------- |
| Behavior change | None — new file only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched     |
| Plugin version  | Unchanged (`5.17.0`)                                     |
| Rollback        | New file; revert the PR                                  |

## Next

F6/F7 (steps 5/6), F8 (the actual `dev.mjs` entry point + SKILL.md + launchers — where every injected
callback across F2–F5 finally gets its real carrier-invocation implementation).
