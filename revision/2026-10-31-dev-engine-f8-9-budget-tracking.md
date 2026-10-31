---
date: 2026-10-31
slug: dev-engine-f8-9-budget-tracking
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#52
---

# engine/budget-tracking.mjs + costUsd propagation (spec/005 stage 7, PR-F8-9)

## Summary

Ninth of stage 7's final sub-PRs (F8). Fixes a gap found while scoping the final-assembly `main()`
wiring: `--max-total-budget-usd` (spec/005 section 2.1's control switches) would have been impossible
to enforce, because every real carrier callback computed a call's actual cost and then discarded it
before returning.

## What this PR changes

`carrier-callbacks.mjs`'s `parseStructuredResponse` now merges `costUsd` into its parsed result,
additively and only when the invoke result actually carries the key. Confirmed directly (not assumed)
that `assert.deepEqual({summary:"x", costUsd: undefined}, {summary:"x"})` fails in Node — an
unconditional merge would have broken 4 pre-existing tests whose fakes model no cost at all, so the
merge is conditional on `invokeResult.costUsd !== undefined`, which is always true on the real success
path (`parseStreamJsonResult` sets it to a number or `null`) and always false for a bare test fake. The
4 existing tests needed zero changes under this design; 2 new tests prove the additive path works when
a fake does supply a cost. `buildRealImplement`/`buildRealFix` already returned the full invoke result,
so they already carried `costUsd` — no change there.

`engine/budget-tracking.mjs` (new): `createBudgetTracker(maxTotalUsd)` sums `addCost` calls and
exposes `.exceeded` once `spentUsd` reaches the cap (never exceeded when `maxTotalUsd` is nullish).
`withCostTracking(fn, addCost)` wraps any async carrier callback, reporting a successful result's
numeric `costUsd` without changing the result — built outside `proposal-review.mjs`/
`implement-review.mjs`/`tier-resolution.mjs` deliberately, so none of their callback contracts change;
it wraps a callback from the outside, at the dependency-injection boundary `dev.mjs`'s `main()` will
build real callbacks at.

**Stated gap**: `buildRealSummarizeAcceptanceCriteria` still unwraps to a bare `checklistItems` array
(`local-service.mjs` iterates it directly, `for (const item of checklistItems)`), so its cost is not
separately surfaced. Accepted because it runs once per merged issue in step 5, after the main per-issue
loop this tracker is built for, not inside it.

## Test result

```
node --test "plugins/openindu-control-tower/engine/*.test.mjs"
# tests 366, pass 366, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump — not yet wired into any entry point).

Mutation checks performed and reverted: the conditional-on-presence guard in
`parseStructuredResponse`, relaxed to an unconditional merge (the 4 pre-existing `deepEqual` tests went
red; reverted); the `>=` boundary in `.exceeded`, relaxed to `>` (the exact-cap test went red;
reverted).

## Impact

| Scope           | Note                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Behavior change | New: `budget-tracking.mjs`. Additive: `costUsd` on 4 callbacks' results (conditional, zero existing-test changes needed) |
| Blast radius    | `openIndu/control-tower` only                                                                                            |
| Plugin version  | Unchanged (`5.19.0`)                                                                                                     |
| Rollback        | Revert the PR — both changes are additive and default-compatible                                                         |

## Next

What remains of stage 7: `dev.mjs`'s `main()` (CLI dispatch, the issue loop wrapping real callbacks
with `withCostTracking` and checking `createBudgetTracker().exceeded` between issues, run-state
persistence/lock/resume, step 5/6 after the loop, final report, exit codes), the `./dev ack`/
`./dev build` subcommands, the `SKILL.md` + launcher templates, and the closing acceptance sweep
against spec/005 §6's 20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
