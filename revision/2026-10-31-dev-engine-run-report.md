---
date: 2026-10-31
slug: dev-engine-run-report
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#67
---

# F8-21: render the final run report (spec/005 section 6 criteria #15/#16)

## Summary

`run-report.mjs` already had `computeOutcomeRates`/`computeRollbackRate`, but nothing rendered
them into the per-issue acceptance matrix criterion #15 requires, and `dev.mjs` never called
either function. This wires both up and adds the renderer.

## What this PR adds

`classifyCiForReport` derives a CI column from `pr-and-merge.mjs`'s existing return-shape fields
(no explicit `ciGreen` flag exists). `renderRunReport` renders the markdown matrix (方案/评审/PR/
CI/合并读回/状态) plus the three rates, an optional RULE 11 checklist section, and a Complete/
Partially complete verdict distinct from any single issue's `MERGED` state. Fixed a related gap in
`issue-pipeline.mjs`'s `BLOCKED` return (was missing `solutionDocument` entirely; renamed its bare
`document` field for naming consistency). `dev.mjs` wires the report into `RUN_COMPLETE` only (not
`DRY_RUN_COMPLETE`, since dry-run results lack `state`).

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 491, pass 491, fail 0
```

10 new tests, including an exact-string snapshot per criterion #15's own verification method.
Mutation-checked 6 points -- each broke exactly its predicted test(s); reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`.

## Impact

| Scope           | Note                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Behavior change | A real run now returns a rendered acceptance-matrix report               |
| Blast radius    | `openIndu/control-tower` only; still unreachable for any real repo today |
| Plugin version  | `5.24.0` -> `5.25.0`                                                     |
| Rollback        | Revert the PR                                                            |

## Next

Step 5 (local-service sequencing) and step 6 (build-readiness info, feeding the report's RULE 11
section); `./dev ack`/`./dev build` subcommand wiring; `SKILL.md` + workspace launchers; CI wiring;
the closing acceptance sweep.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
