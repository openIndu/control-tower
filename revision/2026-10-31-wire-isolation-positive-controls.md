---
date: 2026-10-31
slug: wire-isolation-positive-controls
type: fix
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#71
---

# F8-25: wire isolation positive controls into the real run path

## Summary

Found during spec/005 section 6's closing 20-criterion acceptance sweep: criterion #3's 7
isolation positive controls (section 2.6) were fully implemented and unit-tested
(`run-positive-controls.sh`, `run-agent.mjs`'s `runPositiveControlsOrThrow`) during an earlier
stage, but never actually called from the real run path. `EXIT_CODES.ENVIRONMENT_CHECK_FAILED`
(5) was defined but never assigned anywhere. This is not a stage-7 regression -- it is leftover
integration scope from an earlier stage that the prior "merged" status did not actually cover.

## What this PR fixes

1. `run-agent.mjs`'s `defaultExecShell` ran the positive-control script directly on the trusted
   runner's own host, which cannot prove anything about the sandboxed carrier's isolation. Fixed
   to run through `docker compose run --entrypoint run-positive-controls.sh agent`, the same
   compose service a real agent invocation uses.
2. `dev.mjs`'s `runRepo` now calls `runPositiveControlsOrThrow(carrierDir)` once per run, before
   the first real carrier call (including dry runs, which still invoke the carrier for step 2). A
   failure returns `{outcome: "ENVIRONMENT_CHECK_FAILED", exitCode: 5}` without starting the
   per-issue loop; the run lock is still released.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 518, pass 518, fail 0
```

4 new tests. Mutation-checked the error-type guard and the call site itself -- each broke exactly
its predicted test(s); reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| Behavior change | A real run now refuses (exit 5) if the carrier is not actually isolated            |
| Blast radius    | `openIndu/control-tower` only; still unreachable — no repo has `dev.enabled: true` |
| Plugin version  | `5.28.0` -> `5.29.0`                                                               |
| Rollback        | Revert the PR                                                                      |

## Next

A companion fix for spec/005 section 6 criterion #19's 72-hour ack-downgrade rule (same sweep,
same "built but never wired" shape, different file/mechanism) follows as a separate PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
