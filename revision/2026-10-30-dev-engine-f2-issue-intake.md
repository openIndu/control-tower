---
date: 2026-10-30
slug: dev-engine-f2-issue-intake
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#38
---

# engine/issue-intake.mjs (spec/005 stage 7, PR-F2)

## Summary

Second sub-PR of spec/005 stage 7 (PR-F). Covers the parts of step 1 (issue intake) not already built:
source-permission checks (G10's facts), the body-hash snapshot, and the clean 0-issue exit. Issue
collection itself (`collect-org-issues.mjs --repo`) was already built in stage 4 (`#20`).

## What this PR changes

- `plugins/openindu-control-tower/engine/issue-intake.mjs`:
  - `checkSourcePermissions`: calls `gh api repos/{owner}/{repo}/collaborators/{login}/permission` for the
    issue author and every commenter the caller has already decided belongs in the agent's context.
  - `buildSnapshotEntry` / `buildSnapshot`: bundles each issue with its body hash (reusing the existing
    `computeBodyHash` from `guards-g7-g11.mjs`) and source facts.
  - `writeSnapshot`: writes `snapshot.json`.
  - `formatZeroIssuesReport`: criterion #14's clean 0-issue exit message.

## Known gap

Spec/005 section 2.1 step 1 also names a `complete: true` requirement on collected issues. No documented
field named `complete` exists on GitHub's REST issue payload or `gh issue list`'s JSON output, and the
spec gives no further definition elsewhere (checked). Not implemented here — flagged as an open question
rather than guessed at.

## Test result

7 tests, all passing.

```
node --test plugins/openindu-control-tower/engine/issue-intake.test.mjs
# tests 7, pass 7, fail 0
```

Also passing locally: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no version bump — same `engine/`-exclusion as every prior
stage-4/5/6/7 PR).

## Impact

| Scope           | Note                                                      |
| --------------- | --------------------------------------------------------- |
| Behavior change | None — new files only, not yet wired into any entry point |
| Blast radius    | `openIndu/control-tower` only; no other repo touched      |
| Plugin version  | Unchanged (`5.17.0`)                                      |
| Rollback        | New files; revert the PR                                  |

## Next

F3 (step 2 orchestration), F4 (step 3), F5 (step 4), F6/F7 (steps 5/6), F8 (the actual `dev.mjs` entry
point + SKILL.md + launchers).
