---
date: 2026-10-30
slug: dev-engine-f8-1-dev-entry-skeleton
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#44
---

# skills/dev/scripts/dev.mjs (spec/005 stage 7, PR-F8-1)

## Summary

First of stage 7's final sub-PRs (F8). spec/005 §2.1: `./dev <repo>` (the workspace launcher) and
`/dev <repo>` (the skill) call the same runner, `skills/dev/scripts/dev.mjs`. This PR is the first slice —
CLI skeleton, route resolution, structural-exclusion gate, admission A1-A3, step 1 (issue intake).

## Schema/version note

`skills/` is distributed content; this PR adds `skills/dev/` for the first time, bumping `5.18.0` →
`5.19.0`.

## What this PR changes

- `plugins/openindu-control-tower/skills/dev/scripts/dev.mjs`:
  - `parseArgs`: `--repo`, `--org`, `--dry-run`, `--resume <run-id>`, `--no-merge`, `--help`.
  - Real fact-gatherers for admission A1-A3, normalizing the Statuses API's lowercase state to the
    engine's uppercase convention.
  - `runIntake`: live route fetch → structural-exclusion gate (exit 3) → `evaluateAdmission` (REJECTED
    short-circuits, PR_ONLY does not) → `collect-org-issues.mjs`'s `run()` scoped to one repo → per-issue
    `checkSourcePermissions`/`buildSnapshot`. 0 issues → NO_ACTION exit 0. Unknown repo → exit 1 (not 3).
- `.github/workflows/ci.yml`: added a `skills/dev/scripts/*.test.mjs` glob — the existing `engine/`
  glob didn't cover this new location.

## Test result

12 tests, all passing.

```
node --test plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs
# tests 12, pass 12, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (bump confirmed needed and applied).

## Impact

| Scope           | Note                                                  |
| --------------- | ----------------------------------------------------- |
| Behavior change | None — not referenced by any SKILL.md or launcher yet |
| Blast radius    | `openIndu/control-tower` only                         |
| Plugin version  | `5.18.0` → `5.19.0`                                   |
| Rollback        | New files + a CI glob addition; revert the PR         |

## Next

F8-2 (step 2: proposal/review wired with real carrier invocation), continuing through F8-N.
