---
date: 2026-10-30
slug: dev-engine-f4-implement-review
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#40
---

# engine/implement-review.mjs (spec/005 stage 7, PR-F4)

## Summary

Fourth sub-PR of spec/005 stage 7 (PR-F). Covers step 3's orchestration: implement once, then a
local-gates-then-review-then-fix loop capped at 2 rounds, exceeding which the issue is `BLOCKED`.

## What this PR changes

- `plugins/openindu-control-tower/engine/implement-review.mjs`:
  - `runLocalGates`: runs a list of shell commands, aggregating pass/fail per command and overall.
  - `runStep3`: implement once, then up to 2 rounds of gates → review → fix, reusing the existing
    `PANEL_COMPOSITION` from `review-panel.mjs` (D3a) for the tier's `implReviewers` set.
    `implement`/`review`/`fix` are all injected.

## Design choice: a local-gate failure shares the same round budget as a review-fix

Per spec/005, local gates gate whether a review even happens. In this implementation, a gate failure
consumes a round (triggers `fix`, skips that round's review) under the _same_ 2-round budget as a
review-driven fix, rather than an unbounded or separately-budgeted retry loop. The spec doesn't say
explicitly either way; this is the stricter reading.

## Round cap verified by breaking it

Temporarily lowered `MAX_REVIEW_FIX_ROUNDS` from 2 to 1, confirmed 3 of 7 tests went red, then reverted.

## Test result

7 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/implement-review.test.mjs
# tests 7, pass 7, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6/7 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

F5 (step 4), F6/F7 (steps 5/6), F8 (the actual `dev.mjs` entry point + SKILL.md + launchers).
