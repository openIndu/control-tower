---
date: 2026-10-30
slug: dev-engine-f8-7-verify-checklist-callback
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#50
---

# engine/carrier-callbacks.mjs: buildRealSummarizeAcceptanceCriteria (spec/005 stage 7, PR-F8-7)

## Summary

Seventh of stage 7's final sub-PRs (F8). `local-service.mjs`'s `generateVerifyChecklist` (F6, `#42`)
needed a real `summarizeAcceptanceCriteria` callback — the one piece of step 5 still missing a real
implementation.

## What this PR changes

`plugins/openindu-control-tower/engine/carrier-callbacks.mjs`:
`buildRealSummarizeAcceptanceCriteria(context, {invoke})`. Bash-free `"plan"` role. Returns
`checklistItems` unwrapped (a plain array), matching `generateVerifyChecklist`'s own usage.

## Test result

14 tests (13 existing + 1 new), all passing.

```
node --test plugins/openindu-control-tower/engine/carrier-callbacks.test.mjs plugins/openindu-control-tower/engine/local-service.test.mjs
# tests 26, pass 26, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — `engine/`-only).

## Impact

| Scope           | Note                                                                |
| --------------- | ------------------------------------------------------------------- |
| Behavior change | None — extends an existing file, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only                                       |
| Plugin version  | Unchanged (`5.19.0`)                                                |
| Rollback        | Revert the PR (purely additive)                                     |

## Next

Step 5's real wiring is complete. Step 6 needs no further `engine/` library code (`runAggregateRelease`
is a final-assembly decision). What's left of stage 7 is the final assembly sub-PR: `dev.mjs`'s `main()`,
run-state persistence/resume, and the `SKILL.md` + launcher templates.
