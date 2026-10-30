---
date: 2026-10-30
slug: dev-engine-e3-pr-lifecycle
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#35
---

# engine/pr-lifecycle.mjs (spec/005 stage 6, PR-E3)

## Summary

Third sub-PR of spec/005 stage 6 (PR-E). Covers the PR lifecycle: open as draft, poll CI, evaluate the
pre-promotion guard set, promote to ready, re-check a narrower post-promotion guard set, and the
CI-failure retry loop.

## What this PR changes

- `plugins/openindu-control-tower/engine/pr-lifecycle.mjs`:
  - `openDraftPr`: opens a draft PR via `gh pr create --draft`, parsing the PR number out of gh's printed
    URL.
  - `pollChecks`: polls until every reported check has settled (`status === "COMPLETED"`) or a timeout
    elapses. The `gh pr view --json statusCheckRollup`-backed fetch and the sleep are both injectable.
  - `evaluatePromotionReadiness` / `evaluatePostPromotionRecheck`: thin aggregators over the existing
    `guardG1`-`guardG11` functions from stage 4 — no guard logic duplicated. Per spec/005 section 2.3-4:
    - Pre-promotion: G1–G6, G8–G11 (G7 excluded — meaningless on a still-draft PR).
    - Post-promotion: G1, G2, G7, G8, G10, G11 (a narrower set — promotion can trigger new checks or a
      mergeability race, but can't retroactively change declared scope or risk tier).
  - `promoteToReady`: `gh pr ready <n>`.
  - `runCiRetryLoop`: the CI-failure retry loop from step 4's REASON column ("最多 2 次"). Per RULE 3, only
    the retry-count loop is deterministic code here; the diagnose-and-fix step is an injected callback,
    wired to the real headless invoker once stage 7 assembles the full entry point.

## Guard-set membership verified by breaking it

Two tests pin down the exact guard-set membership per phase. Verified by hand: temporarily added `guardG7`
into `PRE_PROMOTION_GUARDS`, confirmed the "does NOT evaluate G7" test went red, then reverted and confirmed
all 14 pass again.

## Test result

14 tests, all passing in well under 1 second (polling tests inject a no-op fake `sleep` and manipulate
`Date.now` directly for the timeout case, so nothing actually waits).

```
node --test plugins/openindu-control-tower/engine/pr-lifecycle.test.mjs
# tests 14, pass 14, fail 0
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

## Next

E4 (merge execution + readback + circuit-breaker/rollback-detection wiring to the existing stage-4 modules)
closes out stage 6.
