---
date: 2026-10-31
slug: dev-engine-budget-trace
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#65
---

# F8-19: wrap carrier callbacks with budget tracking and trace logging

## Summary

`#63`/`#64`'s `runRepo` called `buildCarrierCallbacks()` directly, so a run's carrier calls never
reported cost anywhere and never persisted a trace, even though `budget-tracking.mjs`'s
`withCostTracking` and `trace-log.mjs`'s `withTraceLogging` both already existed for exactly this.

## What this PR adds

`carrier-setup.mjs` gains `withTrackingWrappers(callbacks, {addCost, appendTrace})`, composing
both wrappers onto each of the 6 carrier callbacks. `dev.mjs` gains `--max-total-budget-usd`
(default `null`), feeding one `createBudgetTracker` shared across the whole run; checked before
starting each new issue (not before every call within one), so a capped-out run stops picking up
new issues while letting an in-progress one finish. `appendTrace` is bound per issue to that
issue's own `docsDir`/`traceFileName`. `RUN_COMPLETE` now reports `budgetExceeded`/`spentUsd`.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 477, pass 477, fail 0
```

9 new tests. Mutation-checked: the exceeded-check guard and the `budgetExceeded`/`spentUsd` return
fields -- each broke exactly its predicted test; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Behavior change | A run can now be cost-capped; carrier traces persist to disk per issue   |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today |
| Plugin version  | `5.22.0` -> `5.23.0`                                                     |
| Rollback        | Revert the PR                                                            |

## Next

`--dry-run`'s stop-after-step-2 mode; step 5/6 sequencing; the final report; `./dev ack`/
`./dev build` subcommand wiring; `SKILL.md` + workspace launchers; CI wiring; the closing
acceptance sweep.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
