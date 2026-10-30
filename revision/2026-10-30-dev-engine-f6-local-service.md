---
date: 2026-10-30
slug: dev-engine-f6-local-service
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#42
---

# engine/local-service.mjs (spec/005 stage 7, PR-F6)

## Summary

Sixth sub-PR of spec/005 stage 7 (PR-F). Covers step 5: build+start the local service in an independent
verification worktree, refusing to start if its resolved env points at production, then health-probe it;
the REASON side generates a manual verification checklist from each issue's acceptance criteria.

## Schema change (version bump)

`dev.local_service` previously had no properties sub-schema. Added `build_command`, `start_command`,
`health_check_url`, `forbidden_env_patterns`. `reference/` is distributed plugin content, so this PR bumps
`5.17.0` → `5.18.0` — the first PR in stage 6/7 to need a bump (every prior PR only touched `engine/`,
which is excluded).

## What this PR changes

- `plugins/openindu-control-tower/engine/local-service.mjs`:
  - `checkNotPointingAtProduction`: case-insensitive substring scan against `forbidden_env_patterns`.
    Motivated by a real prior incident in this workspace (a local stack that was talking to a remote
    production database unnoticed).
  - `createVerificationWorktree`: one shared worktree pulling the current default branch.
  - `startLocalService`: runs the production check before build/start, throws `PointsAtProductionError`
    on a match. Runs `build_command` synchronously, starts `start_command` detached.
  - `probeHealth`: polls `health_check_url` until OK or timeout (same shape as E3's `pollChecks`).
  - `generateVerifyChecklist`/`writeVerifyChecklist`: REASON-side checklist generation + file write.

## Test result

12 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/local-service.test.mjs
# tests 12, pass 12, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (bump confirmed needed and applied).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | `5.17.0` → `5.18.0`                                       |
| Rollback        | Revert the PR; the schema addition is purely additive     |

## Next

F7 (step 6: `./dev build`), F8 (the actual `dev.mjs` entry point + SKILL.md + launchers).
