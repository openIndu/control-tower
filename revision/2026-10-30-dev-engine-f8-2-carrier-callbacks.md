---
date: 2026-10-30
slug: dev-engine-f8-2-carrier-callbacks
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#45
---

# engine/carrier-callbacks.mjs (spec/005 stage 7, PR-F8-2)

## Summary

Second of stage 7's final sub-PRs (F8). F3's `proposal-review.mjs` takes `generateProposal`/
`reviewProposal` as injected callbacks; this PR builds their real implementations on top of F1's
`invokeAgent` and D2's `buildDockerComposeRunArgs`.

## What this PR changes

- `plugins/openindu-control-tower/engine/carrier-callbacks.mjs`:
  - `DEFAULT_PLAN_REVIEW_BUDGET_USD` (`1.0`): a documented default, not spec-mandated (§2.6 leaves this to
    runner policy).
  - `buildSystemPromptText`: `buildAppendSystemPrompt` with a fixed Rule #1 anchor.
  - `buildRealGenerateProposal`/`buildRealReviewProposal`: write a real prompt file per call, request
    Bash-free `"plan"`/`"review"` roles, attach a JSON schema matching F3's exact expected shapes, throw
    on a failed/textless invocation.

## A real bug the first test run caught

The test file's `withTempDir` helper didn't `await` its async callback before `finally`'s cleanup, so two
tests failed with files reported missing right after being written. Fixed; reran, all 6 passed.

## Test result

6 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/carrier-callbacks.test.mjs
# tests 6, pass 6, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                     |
| --------------- | -------------------------------------------------------- |
| Behavior change | None — new file only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                            |
| Plugin version  | Unchanged (`5.19.0`)                                     |
| Rollback        | New file; revert the PR                                  |

## Next

F8-3 and onward: wiring `dev.mjs`'s step 2 to use these real callbacks, then real wiring for steps 3-6.
