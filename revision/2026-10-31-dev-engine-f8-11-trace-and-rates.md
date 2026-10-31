---
date: 2026-10-31
slug: dev-engine-f8-11-trace-and-rates
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#54
---

# Redacted trace persistence + degradation/human-correction/rollback rates (spec/005 stage 7, PR-F8-11)

## Summary

Eleventh of stage 7's final sub-PRs (F8). Closes spec/005 section 6 criterion #16: the run report
must persist a redacted stream-json trace and report a degradation rate, a human-correction rate,
and a rollback rate. None of this existed before this PR.

## What this PR changes

`carrier/run-agent.mjs`'s `invokeAgent` now returns `rawStdout` alongside its already-parsed
result (additive -- confirmed no existing test asserts the exact return shape; `run-agent.test.mjs`
checks individual fields only). `carrier-callbacks.mjs`'s `parseStructuredResponse` merges it
through too, using the exact conditional-on-presence shape F8-9 (#52) established for `costUsd`,
for the identical reason: confirmed directly that an unconditional merge breaks 5 pre-existing
tests (4 bare-shape tests plus the `costUsd` exact-shape test itself), reverted before landing the
conditional version.

`engine/trace-log.mjs` (new): `appendTraceEntry` writes one redacted JSON line per carrier call to
a per-issue trace file (`issue-<n>-trace.jsonl`, in the same docs dir `docs-dir.mjs` resolves) --
an accumulating log across an issue's lifecycle (scoping, each proposal, each review round,
implement, fix, CI-fix retries), not a once-only artifact like the solution/review documents, so
it appends rather than refusing to overwrite. `withTraceLogging` wraps any real carrier callback
the same non-invasive way `budget-tracking.mjs`'s `withCostTracking` does -- both wrap the same
real invoke result from the outside, independently, at `dev.mjs`'s `main()`.

`engine/run-report.mjs` (new): `computeOutcomeRates` reuses `states.mjs`'s own `isClean`/
`needsHuman` classifiers rather than re-deriving a second state grouping -- degraded is simply
"not clean" in that module's vocabulary; `BLOCKED`/`FAILED` fold into degradation too, since the
spec names only three rates, not a fourth "failure rate" alongside them. `computeRollbackRate`
reuses `circuit-breaker.mjs`'s existing `detectRevertOfRecordedMerge` against a run's own recorded
merge SHAs and a fresh read of the default branch's post-run commit log.

**Deliberately out of scope**: rendering the per-issue acceptance matrix (criterion #15). That
table's input shape should be designed alongside `dev.mjs`'s `main()` accumulator, not guessed at
before `main()` exists -- these two rate functions have no such dependency, since their inputs are
already fully specified by existing modules.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 429, pass 429, fail 0
```

2 new in `carrier-callbacks.test.mjs`, 1 new in `run-agent.test.mjs`, 7 new in
`trace-log.test.mjs`, 7 new in `run-report.test.mjs`.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed -- `engine/` only).

Mutation checks performed and reverted, each confirmed red then fixed: the `rawStdout`
conditional merge (made unconditional -- 5 predicted failures), `withTraceLogging`'s result-shape
guard, the `isClean` degradation filter (inverted -- 2 failures), and the rollback revert-match
filter (inverted -- 2 failures).

## Impact

| Scope           | Note                                                                                  |
| --------------- | ------------------------------------------------------------------------------------- |
| Behavior change | New: `trace-log.mjs`, `run-report.mjs`. Additive: `rawStdout` on 2 existing functions |
| Blast radius    | `openIndu/control-tower` only                                                         |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only, not distributed `skills/` content             |
| Rollback        | Revert the PR -- every change is additive                                             |

## Next

What remains of stage 7: `dev.mjs`'s `main()` itself (CLI dispatch, the per-issue loop composing
`withCostTracking`+`withTraceLogging` around real callbacks, run-state persistence/lock/resume,
step 5/6 sequencing after the loop, the per-issue acceptance-matrix table from criterion #15
alongside the rates this PR computes, exit codes), the `./dev ack`/`./dev build` subcommands, the
`SKILL.md` + the two workspace launchers (not git-tracked in this repo), and the closing acceptance
sweep against spec/005 §6's 20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
