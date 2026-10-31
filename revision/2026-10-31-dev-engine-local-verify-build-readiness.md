---
date: 2026-10-31
slug: dev-engine-local-verify-build-readiness
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#68
---

# F8-22: wire step 5 (local verification) and step 6 readiness into the run report

## Summary

`local-service.mjs` (step 5) and `build-step.mjs` (step 6) were both already built with full test
coverage, but nothing in `dev.mjs` ever called either one. This wires both into `runRepo`, once per
repo after the per-issue loop closes.

## What this PR adds

Step 5: when `dev.local_service` is configured, creates a verification worktree on the current
default branch, starts the service (production-env refusal runs first), health-probes it, and
writes a manual-verification checklist scoped to this run's `MERGED` issues only. A failure
(including the production-check refusal) is caught and reported on the result rather than thrown,
so it never erases the per-issue results already produced. Step 6: `evaluateBuildReadiness` feeds
the report's RULE 11 section as pure readiness info -- never auto-building; `rule11Status` is
`undefined` since RULE 11 step ③ is a cross-repo fact this runner cannot check, which conservatively
resolves to `PENDING` rather than a wrong `READY_TO_BUILD`. `run-report.mjs` gained an optional
"## Local verification" section matching the existing optional RULE 11 section's pattern.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 502, pass 502, fail 0
```

19 new tests. Mutation-checked 7 points -- each broke exactly its predicted test(s); reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Behavior change | A real run now attempts local verification and reports build readiness   |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today |
| Plugin version  | `5.25.0` -> `5.26.0`                                                     |
| Rollback        | Revert the PR                                                            |

## Next

`./dev ack`/`./dev build` subcommand wiring; `SKILL.md` + workspace launchers; CI wiring; the
closing acceptance sweep against all 20 rows of spec/005 section 6.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
