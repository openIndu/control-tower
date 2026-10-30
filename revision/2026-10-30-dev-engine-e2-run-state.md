---
date: 2026-10-30
slug: dev-engine-e2-run-state
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#34
---

# engine/run-state.mjs (spec/005 stage 6, PR-E2)

## Summary

Second sub-PR of spec/005 stage 6 (PR-E). Covers run-state: idempotent per-issue step tracking and a
single-run-per-repo lock, required by spec/005 section 2.1's recoverability invariant — "每次运行有 run-id
与 state.json，每步幂等（不重复开 PR、不重复合并），可 `--resume`；同一仓同时只允许一个运行（锁文件）".

## What this PR changes

- `plugins/openindu-control-tower/engine/run-state.mjs`:
  - `createRunState` plus per-issue idempotency flags: `hasOpenedPr`/`markPrOpened`,
    `hasPromotedToReady`/`markPromotedToReady`, `hasMerged`/`markMerged`, `markAcked`. A `--resume`d run
    checks these before acting, so it never reopens a PR or re-merges something already merged.
  - `saveRunState`/`loadRunState`: plain JSON file round-trip.
  - `acquireRunLock`/`releaseRunLock`/`RunLockHeldError`: the single-run-per-repo lock. Reacquiring with the
    same `runId` is idempotent (what `--resume` does); a different `runId` finding the lock held throws
    rather than waiting or stealing it. `releaseRunLock` only deletes a lock that currently names the
    caller's own `runId`.

Mutators return a new state object rather than mutating in place, matching the functional style already
used by the guard/circuit-breaker modules (facts in, fresh verdict out).

## Test result

7 new tests: per-issue flag independence, non-mutation of input state, JSON round-trip, lock contention,
idempotent reacquire, release-only-if-owned, release-when-absent.

```
node --test plugins/openindu-control-tower/engine/run-state.test.mjs
# tests 7, pass 7, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/` stays outside
`check-version-bump.mjs`'s `DISTRIBUTED_PREFIXES`).

## Impact

| Scope           | Note                                                     |
| --------------- | -------------------------------------------------------- |
| Behavior change | None — new file only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched     |
| Plugin version  | Unchanged (`5.17.0`)                                     |
| Rollback        | New file; revert the PR                                  |

## Next

E3 (PR lifecycle: draft→ready promotion, CI polling, retry) and E4 (merge execution + readback +
circuit-breaker/rollback-detection wiring to the existing stage-4 modules) close out stage 6.
