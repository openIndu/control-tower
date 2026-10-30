---
date: 2026-10-30
slug: dev-engine-f7-build-step
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#43
---

# engine/build-step.mjs (spec/005 stage 7, PR-F7)

## Summary

Seventh sub-PR of spec/005 stage 7 (PR-F). Covers step 6: `./dev build <repo>` is not part of the
automatic 6-step pipeline — a separate subcommand that only runs after explicit user confirmation, and the
runner never holds image-registry credentials. This module computes readiness and renders the RULE 11
status report; it does not build or push anything itself.

## What this PR changes

- `plugins/openindu-control-tower/engine/build-step.mjs`:
  - `evaluateBuildReadiness`: `dev.build: null` → `N/A`; aggregate-routed + RULE 11 step ③ not merged →
    `PENDING`; otherwise `READY_TO_BUILD`.
  - `runBuildStep`: short-circuits on `N/A`/`PENDING`; reports `AWAITING_CONFIRMATION` when not confirmed;
    only calls the injected `runAggregateRelease` once ready and confirmed.
  - `assertNoCredentialLikeFields`: throws if any field anywhere in the inputs looks credential-shaped.
  - `renderRule11StatusChecklist`: markdown checkbox list for RULE 11 steps ③–⑥.

## Test result

10 tests, all passing. Mutation-verified the credential tripwire: disabled it, confirmed 9/10 (red),
reverted, confirmed 10/10.

```
node --test plugins/openindu-control-tower/engine/build-step.test.mjs
# tests 10, pass 10, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Note on spec/005 §6 criterion #18

Verified (not new work in this PR): `ci.yml`'s `/dev engine unit tests` step already globs
`engine/*.test.mjs` under plain `node <file>`, which has been running every new engine test file across
E1–E4 and F1–F7 in CI automatically. Confirmed plain `node <file>` actually enforces failures (a
deliberately-broken `node:test` case exits `1`). Criterion #18 has been satisfied incrementally.

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.18.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

F8 — the actual `dev.mjs` entry point + SKILL.md + launchers. Last planned sub-PR of stage 7.
