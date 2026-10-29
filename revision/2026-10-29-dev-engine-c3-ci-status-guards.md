---
date: 2026-10-29
slug: dev-engine-c3-ci-status-guards
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#22
---

# engine: CI status classification and guards G1/G2/G3/G5/G6 (spec/005 stage 4, PR-C3)

## Summary

Third PR implementing the deterministic `/dev` engine (`#20` states/exit-codes, `#21` route/admission). Adds `engine/ci-status.mjs` (green/not-green classification shared by G2 and the eventual G8) and `engine/guards-core.mjs` (G1, G2, G3, G5, G6).

## Scope change: stage 4's 4-PR split becomes 5

G4 (protected paths + test-integrity detection) needs its own glob matcher plus diff-text heuristics for skip/xfail/only/coverage-threshold changes — enough additional surface that bundling it here would blow past the same ≤400-line/one-module-boundary discipline that split stage 4 into multiple PRs in the first place. It becomes its own PR (**C3b**, protected-paths + test-integrity), between this one and what was originally planned as C4 (G7-G11 + circuit breaker + `.dev-pause` + `./dev ack` + log redaction + `ci.yml` wiring). Noting this here rather than silently shipping a different count than stated in `#20`/`#21`'s bodies.

## Files touched

| File                                                | Change   | Note                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/ci-status.mjs`                              | new      | `isCheckGreen` (SUCCESS only), `allRequiredChecksGreen` (a required check that never ran is "missing", same as one that failed)                                                                                                                                                                                                                                                                                                         |
| `engine/guards-core.mjs`                            | new      | `guardG1` (SHA/patch-id match, with the update-branch patch-id-equivalence exception), `guardG2` (required-checks-green), `guardG3` (must-fix count only — no "agent approved it" input path exists anywhere, so nothing here can promote a merge, only veto one), `guardG5` (size AND module-boundary, stricter than RULE 4's OR), `guardG6` (risk tier ≤L2, tier may only rise never fall, confidence floor, review-uncertainty veto) |
| `engine/ci-status.test.mjs`, `guards-core.test.mjs` | new      | `node:test` + `node:assert/strict`                                                                                                                                                                                                                                                                                                                                                                                                      |
| `plugin.json`, `marketplace.json`                   | modified | `5.8.0` → `5.9.0`                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Mutation-style verification

- `guardG6`'s tier-only-rises check: short-circuited to `if (false && ...)`. Result: exactly the one test covering a lowered tier failed (17 pass / 1 fail). Reverted.
- `guardG5`'s 400-line limit: changed the threshold to 40000. Result: exactly the test for exceeding 400 lines failed (17 pass / 1 fail). Reverted.

Both back to 18/18 after restoring.

## Test result

```
engine/ci-status.test.mjs:   14/14
engine/guards-core.test.mjs: 18/18
```

Plus C1/C2's unchanged suites (73 tests across states/exit-codes/collect-org-issues/route-reader/admission) still passing. `check-version-bump.mjs` (`5.8.0 → 5.9.0`), `sync-route.mjs --check`, `prettier --check "**/*.md"`, `claude plugin validate --strict` all pass locally. Not yet wired into `ci.yml` — still deferred to the final PR of this split.

## Impact

| Scope           | Note                          |
| --------------- | ----------------------------- |
| Behavior change | None                          |
| Rollback        | Revert the PR; new files only |

## Next

C3b (protected paths + test-integrity detection, i.e. the rest of G4), then C4 (G7-G11 + circuit breaker + revert detection + `.dev-pause` + `./dev ack` + log redaction + `ci.yml` wiring).
