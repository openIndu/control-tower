---
date: 2026-10-31
slug: dev-engine-run-state
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#64
---

# F8-18: wire run-state persistence, the run lock, and --resume into runRepo

## Summary

`#63`'s `runRepo` passed a fresh `{}` `resumeIssueState` and a `null` `resumePrNumber` to every
issue regardless of `--resume`, and never acquired the repo lock spec/005 section 2.1 requires.
This wires both in.

## What this PR adds

A repo-scoped `.dev-run.lock` (alongside `.dev-pause`), acquired before any mutating action and
released in a `finally`. A different run holding the lock returns a structured `RUN_LOCKED`
result. `state.json` lives in the run's own `docsDir`; `--resume` loads it, a fresh run creates
it. Each issue's `resumeIssueState` comes from `getIssueState`, and its `prNumber` flows into the
per-issue `runContext`'s `resumePrNumber` override. `runState` updates (`markPrOpened`/
`markMerged`) and saves after every issue, not batched at the end.

Simplified away a redundant `&& !resumeIssueState.openedPr` guard on `markPrOpened` -- provably
could never change behavior given `runStep4`'s own resume semantics and `markPrOpened`'s
merge-patch idempotency.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 472, pass 472, fail 0
```

6 new tests. Mutation-checked: the `finally` block, the `MERGED` condition, and the
`resumePrNumber` wiring -- each broke exactly its predicted test; reverted. Caught and fixed one
flaky test (`createRunState`'s `startedAt` timestamp racing a reconstructed "expected" object);
confirmed fixed with 5 consecutive clean runs.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Behavior change | A crash mid-run now leaves durable per-issue state; `--resume` is real   |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today |
| Plugin version  | `5.21.0` -> `5.22.0`                                                     |
| Rollback        | Revert the PR                                                            |

## Next

`--max-total-budget-usd`/trace-log wrapping around the carrier callbacks; `--dry-run`'s
stop-after-step-2 mode; step 5/6 sequencing; the final report; `./dev ack`/`./dev build`
subcommand wiring; `SKILL.md` + workspace launchers; CI wiring; the closing acceptance sweep.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
