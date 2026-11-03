---
date: 2026-11-03
slug: dev-workflow-retirement
type: other # 同时涉及 principle / route / feature removal
related_spec: 005-org-dev-workflow, 006-standing-merge-authorization
author: control-tower
pr: TBD — filled in once the PR is opened
---

# Retire /dev (spec/005 + spec/006) entirely

## Summary

The maintainer's own verdict: "我想删除dev工作流,因为这个工作流就是垃圾,我已经有了
/issue-pipeline...我无法获取 CLAUDE_CODE_OAUTH_TOKEN,我不想走哪条路了." `/dev` existed to
solve one problem `/issue-pipeline` already solves more simply (issue → PR, human merges
later) plus one capability `/issue-pipeline` deliberately doesn't have: spec/006's
unattended standing-authorization merge. That one differentiator never ran for real even
once — this machine never got a usable `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
credential path working end to end despite #83's fix, and `dev_grants` stayed `[]` for the
entire life of the spec. A two-agent independent review (`arbiter` + `inspector`,
2026-11-03) confirmed the retirement and surfaced the one thing a code-only grep would have
missed: spec/006's SA-1 clause lives as prose inside `principle/SKILL.md` itself, loaded by
every agent in every repo via `/principle` — deleting the engine without reverting that text
would leave an unenforceable merge-authorization mechanism on the books, worse than before
spec/006 existed.

## What this PR does

Deletes `/dev` down to the two pieces spec/006 §5 didn't pre-authorize touching without
review (the replacement skills, tracked separately as spec/008) and executes the one piece
it did pre-authorize (the principle-text revert, no fresh arbiter round needed):

- Deleted entirely: `plugins/openindu-control-tower/skills/dev/` (SKILL.md + scripts),
  `plugins/openindu-control-tower/engine/` (148 files: states/guards/admission/carrier/
  pr-lifecycle/etc., one `.mjs` + one `.test.mjs` each), `plugins/openindu-control-tower/evals/`
  (both `dev-reasoning-layer` and `standing-authorization` — confirmed via independent review
  as 100% /dev-scoped, nothing else referenced either), `reference/dev.schema.json`.
- `plugins/openindu-control-tower/reference/route.json` (+ regenerated root `route.json` via
  `sync-route.mjs`, not hand-edited): removed top-level `dev_grants: []` and
  `openindu-studio`'s `dev.enabled`/`dev.build` block.
- `plugins/openindu-control-tower/skills/principle/SKILL.md`: reverted the 4 spots spec/006
  added to RULE 4/RULE 5.2 (the standing-authorization footnote, the SA-1 clause itself, and
  the two review-bullet cross-references), verified byte-for-byte against this machine's own
  stale pre-006 plugin cache (`~/.claude/plugins/cache/.../5.2.1/skills/principle/SKILL.md`)
  to confirm the revert text is exact. Per spec/006 §5, this does not need a fresh arbiter
  round.
- Found one real dependency a plain `engine/` grep missed: `scripts/check-pr-scope.mjs` (this
  repo's own RULE 4 size/test-integrity/protected-path gate, run on **every** PR, not just
  /dev's) imported 3 already-generic pure functions from `engine/` as a library
  (`changedProtectedPaths`, `checkTestIntegrity`, `countTopLevelDirectories`). Extracted them
  verbatim into a new `scripts/diff-checks.mjs` (dropping only the one function
  `check-pr-scope.mjs` never used, `pathsOutsideDeclaredScope`, which was genuinely
  /dev-G4-specific) before deleting `engine/`, so this gate keeps working unchanged.
- `.github/workflows/ci.yml`: renamed the `/dev engine unit tests` step to
  `control-tower script unit tests`, dropped the now-nonexistent `engine/**/*.test.mjs` and
  `skills/dev/scripts/*.test.mjs` globs (keeping `collect-org-issues.test.mjs` and
  `check-pr-scope.test.mjs`, neither of which is /dev's), and cleaned the stale explanatory
  comments above both steps.
- `CLAUDE.md`: removed the `/dev` skills-table row, renamed "Org-wide batch pipelines
  (deterministic engine, spec/005)" to "Org-wide issue intake" (now just `/issue-pipeline`),
  dropped `engine/` and `evals/` from the directory-structure diagram, corrected the skill
  count 16→15 in three places (prose header, mermaid diagram, `disable-model-invocation`
  count 11→10 — verified `dev/SKILL.md` carried that flag before relying on the count).
- `spec/005-org-dev-workflow.md`, `spec/006-standing-merge-authorization.md`: `status:
finalized` → `superseded`, each with a `Superseded on 2026-11-03` note under the title
  (matching spec/003's precedent) and a final changelog row. Not deleted — RULE 6; the ~70
  historical `revision/*dev-engine*.md` records are untouched for the same reason.
- `spec/README.md`: index rows for 005/006 updated to `superseded`.

## Test result

```
node --test scripts/check-pr-scope.test.mjs
# tests 12, pass 12, fail 0
```

Also passing: `prettier --check "**/*.md"`, `claude plugin validate --strict`,
`sync-route.mjs --check`, `check-roster.mjs`, `check-version-bump.mjs`,
`collect-org-issues.test.mjs`, `block-push-main.test.mjs`. `diff --( "$HOME/.claude/plugins/
cache/openindu/openindu-control-tower/5.2.1/skills/principle/SKILL.md" plugins/
openindu-control-tower/skills/principle/SKILL.md` shows only 3 remaining differences, all
unrelated pre-existing fixes (two lowercase repo-name corrections, one registry-hostname
redaction) — confirming the SA-1 revert is exact with no collateral change.

## Impact

| Scope           | Note                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | `/dev` no longer exists as a command; `dev_grants` no longer exists as a concept anywhere in route.json or principle.md. `/issue-pipeline` is unaffected — it never called `/dev`.  |
| Blast radius    | `openIndu/control-tower` plugin only. No repo ever had `dev.enabled: true` besides the already-"not yet actionable" studio note, so no downstream repo loses working functionality. |
| Spec            | spec/005, spec/006 both `status: superseded`; revert pre-authorized by spec/006 §5, no fresh arbiter round                                                                          |
| Plugin version  | `5.32.0` -> `5.33.0` (distributed content changed: `skills/`, `engine/`, `evals/`, `reference/`)                                                                                    |
| Rollback        | Revert this PR; the deleted content is fully recoverable from git history (this commit's parent)                                                                                    |

## Next

A narrower replacement lineup (`/research`, `/prod`, `/dev` redefined as plain
implementation with none of the removed sandbox/credential/merge machinery, `/test`,
`/publish`, `/pr_merge`, plus folding `/dev_issue`-shaped per-issue dispatch into
`/issue-pipeline` itself) is being drafted separately as spec/008, informed by this same
2026-11-03 two-agent review. Also flagged by that review but out of this PR's scope: the
`/memory` skill (confirmed empty — zero role-memory content ever written) and the
`/launch`+`/design` team-spawn orchestration mechanism (confirmed never successfully used —
distinct from `/design`'s artifact contract, which is real and stays) are both slated for
cleanup as part of spec/008 rather than here, per the maintainer's explicit choice to bundle
them with the replacement lineup instead of a third separate change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
