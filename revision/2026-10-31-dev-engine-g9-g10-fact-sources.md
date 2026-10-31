---
date: 2026-10-31
slug: dev-engine-g9-g10-fact-sources
type: feature
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#58
---

# F8-13: sourcing guardG9/guardG10's last two unresolved fields

## Summary

Closes the last two genuine gaps the F8-12 research pass flagged with "no existing source found
anywhere": `guardG9`'s `authorizedApprovers` and `guardG10`'s `acceptanceCriteriaCrowdDerived`.
Both resolved by reading the guards' own logic and RULE 5.3's exact text directly, not by
guessing.

## What this PR adds

**guardG9 / authorizedApprovers**: RULE 5.3's exact text -- "The owner of every changed path
(CODEOWNERS) is the approver" -- confirms G9 is a CODEOWNERS self-consistency check, not a
cross-reference against a separately maintained roster (none exists in route.json/
dev.schema.json). New `engine/authorized-approvers.mjs`: `listAuthorizedApprovers({org, repo},
execGh)` calls `gh api repos/{org}/{repo}/collaborators --jq '[.[] | select(.permissions.push ==
true) | .login]'`, matching the existing `defaultExecGh` DI pattern. Returns `@`-prefixed logins
to match `codeowners.mjs`'s raw owner tokens. Stated simplification: only individual `@login`
entries resolve; CODEOWNERS team entries (`@org/team-name`) are not expanded to members.

**guardG10 / acceptanceCriteriaCrowdDerived**: a judgment about whether the issue body itself
states acceptance criteria, or whether satisfying it would require inferring them from comment
discussion. Added as a new required field on `carrier-callbacks.mjs`'s `SCOPING_SCHEMA`
(alongside the existing `reviewerStatedUncertain` self-report), with a matching prompt-text
addition. Traced the full data path before trusting it survives (the `declaredPaths` lesson from
#57): `resolveTier` passes `scoping` through by reference unchanged, and `parseStructuredResponse`
does a full spread, not field-specific destructuring -- confirmed by reading both directly.

## Test result

```
node --test "plugins/openindu-control-tower/engine/**/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 434, pass 434, fail 0
```

3 new tests in `authorized-approvers.test.mjs`, 1 new assertion in `carrier-callbacks.test.mjs`.
Mutation checked: the `@` prefix mapping, removed, broke exactly 1 predicted test; reverted.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (no bump needed).

## Impact

| Scope           | Note                                                              |
| --------------- | ----------------------------------------------------------------- |
| Behavior change | Additive only -- new module, new required schema field            |
| Blast radius    | `openIndu/control-tower` only; nothing live calls either path yet |
| Plugin version  | Unchanged (`5.20.0`) -- `engine/` only                            |
| Rollback        | New files + an additive schema field -- revert the PR             |

## Next

Every `buildStep4Deps` field-sourcing question raised by #52's research pass is now resolved:
pure reuse, naming-mismatch renames, `git-ops.mjs`'s `currentCommitSha` for G1 (reviewedSha
captured once post-commit, ciEvaluatedSha re-read as prHeadSha, patch-id fields deliberately
omitted -- any real CI-fix code change correctly escalates to human, a safe default per RULE 4),
and now G9/G10's two fact sources here. The real `buildStep4Deps` module -- assembling commit
message, carrier config, PR title/body, and the full `internalFacts` map into what
`step4-callbacks.mjs`'s `buildStep4Callbacks` needs -- is next, followed by `main()`'s per-repo
loop, resume, the acceptance-matrix report, `./dev ack`/`./dev build`, `SKILL.md` + launchers, and
the closing acceptance sweep against spec/005 §6's 20-row table.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
