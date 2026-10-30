---
date: 2026-10-30
slug: dev-engine-f8-5-implement-fix-review
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#48
---

# engine/carrier-callbacks.mjs extensions (spec/005 stage 7, PR-F8-5)

## Summary

Fifth of stage 7's final sub-PRs (F8). `implement-review.mjs`'s `runStep3` (F4, `#40`) needs real
`implement`, `review` and `fix` callbacks.

## What this PR changes

`plugins/openindu-control-tower/engine/carrier-callbacks.mjs` (extends `#45`, `#46`): `buildRealImplement`
(role `"implement"`, explicit Bash allowlist, never commits), `buildRealFix` (same shape,
`formatFailureDescription` includes only the failing gate's output), `buildRealReviewImplementation`
(Bash-free `"review"` role, judges a pre-computed `git diff HEAD` embedded in the prompt, dedicated
`IMPLEMENT_REVIEW_SCHEMA`).

## Test result

12 tests, all passing, including a mutation check on the failing-gate-only filter.

```
node --test plugins/openindu-control-tower/engine/carrier-callbacks.test.mjs
# tests 12, pass 12, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                                |
| --------------- | ------------------------------------------------------------------- |
| Behavior change | None — extends an existing file, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                                       |
| Plugin version  | Unchanged (`5.19.0`)                                                |
| Rollback        | Revert the PR (purely additive)                                     |

## Next

Step 4's mechanical PR/merge-lifecycle adapters (F8-6), then step 5/6, then the final assembly sub-PR.
