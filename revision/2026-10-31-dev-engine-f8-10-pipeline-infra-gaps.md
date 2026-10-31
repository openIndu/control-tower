---
date: 2026-10-31
slug: dev-engine-f8-10-pipeline-infra-gaps
type: other
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#53
---

# Four pipeline-infra gaps closed before final assembly (spec/005 stage 7, PR-F8-10)

## Summary

Tenth of stage 7's final sub-PRs (F8). Before designing `dev.mjs`'s `main()` — the last piece
tying the whole pipeline together — re-read spec/005 in full rather than working from the running
summary of prior sessions' paraphrase of it. That re-read surfaced four real gaps none of the
narrower F8-1..F8-9 sub-PRs had needed to touch. This PR closes all four.

## What this PR changes

1. **`dev.enabled` admission gate.** Section 2.4 documents `dev.enabled` defaulting to `false`;
   section 2.3-2's exit-code-3 list names it alongside structural exclusion and A1 failure
   ("排除类型、未启用、A1 不满足"). `dev.mjs`'s `runIntake` checked neither before this PR — any
   repo with adequate CI would be processed regardless of whether the org had opted it into `/dev`
   at all. Fixed with a `REJECTED`/exit-3 short-circuit immediately after the structural-exclusion
   check, before admission facts are gathered (so an unauthorized repo never even triggers a CI
   status read).

2. **`engine/worktree.mjs`'s `ensureRepoClone`/`defaultRepoClonePath`.** `createIssueWorktree`
   assumes `repoPath` is already an existing local clone; nothing in `engine/` or `skills/` ever
   built one. `ensureRepoClone` is idempotent: clones into `<baseDir>/clones/<org>/<repo>` if
   absent, otherwise runs `git fetch origin` — never force-resets or deletes an existing clone.

3. **`engine/docs-dir.mjs`.** Section 2.1 requires solution/review documents to be written to
   `mem_docs/<repo>/dev-runs/<run-id>/`, overridable via `OPENINDU_DOCS_DIR`, never overwriting a
   prior run's output (RULE 6). Before this PR the documents existed only as in-memory strings
   returned from `runStep2`/`runStep3`, never persisted anywhere. `resolveDocsDir` defaults
   relative to `process.cwd()` (the workspace launcher is expected to invoke the runner from the
   workspace root; `OPENINDU_DOCS_DIR` exists precisely so a caller never has to rely on that
   holding). `solutionDocFileName`/`reviewDocFileName` match spec's own naming. `writeIssueDocument`
   throws `DocumentAlreadyExistsError` rather than silently clobbering.

4. **`engine/pr-content.mjs`.** `step4-callbacks.mjs`'s context expects `prTitle`/
   `prBodyFilePath`, but nothing rendered either. Section 2.1's PR-body requirement (intent, blast
   radius, rollback, test results) is already fully satisfied by embedding the already-produced
   solution/review documents verbatim rather than re-deriving a shorter summary from data this
   module doesn't cleanly have. `renderPrBody` adds the R3 publishes-on-merge disclosure
   (`dev.publishes_on_merge`) as a separate called-out section, since a squash-merge revert cannot
   un-publish an image a main-branch push already pushed.

Also fixes a related gap surfaced by (4): `issue-pipeline.mjs`'s call to `buildStep4Deps` passed
only `{worktreePath, branchName, issue, tier}` — never the documents `runStep2`/`runStep3` just
produced. A real `buildStep4Deps` would have had no way to build a PR body on a fresh run. Now
passes `solutionDocument: step2Result?.document ?? null` and
`implementationReviewDocument: step3Result?.document ?? null` through (both stay `null` on resume,
where `openPr()` never runs anyway).

Plugin version bumped 5.19.0 → 5.20.0: this is the first F8-N sub-PR to touch
`skills/dev/scripts/dev.mjs` (distributed plugin content), which the earlier engine-only PRs never
triggered.

## Test result

```
node --test "plugins/openindu-control-tower/engine/*.test.mjs" "plugins/openindu-control-tower/skills/dev/scripts/dev.test.mjs"
# tests 390, pass 390, fail 0
```

13 in `dev.test.mjs` (1 new), 9 in `worktree.test.mjs` (2 new), 5 new in `docs-dir.test.mjs`, 3 new
in `pr-content.test.mjs`, `issue-pipeline.test.mjs` extended with a document-passthrough assertion.

Also passing: `prettier --check`, `claude plugin validate --strict`, `sync-route.mjs --check`,
`check-roster.mjs`, `check-version-bump.mjs` (5.19.0 → 5.20.0, correctly flagged and applied).

Mutation checks performed and reverted, each confirmed red then fixed: the `dev.enabled` gate
(replaced with `if (false)`), the clone-vs-fetch `existsSync` branch (replaced with `if (false)`),
the RULE 6 overwrite guard in `writeIssueDocument` (replaced with `if (false)`), and the
`buildStep4Deps` document passthrough (reverted to the old three-field call).

## Impact

| Scope           | Note                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior change | New: `docs-dir.mjs`, `pr-content.mjs`. New gate in `dev.mjs`'s `runIntake`. Additive: `ensureRepoClone` in `worktree.mjs`; document passthrough in `issue-pipeline.mjs` |
| Blast radius    | `openIndu/control-tower` only                                                                                                                                           |
| Plugin version  | `5.19.0` → `5.20.0`                                                                                                                                                     |
| Rollback        | Revert the PR — all four changes are additive or a stricter (never looser) admission check                                                                              |

## Next

What remains of stage 7: `dev.mjs`'s `main()` itself (CLI dispatch, the per-issue loop wrapping
real callbacks with F8-9's `withCostTracking`/`createBudgetTracker`, run-state persistence/lock/
resume, step 5/6 sequencing after the loop, final report rendering per spec/005 §6 criteria #15/#16,
exit codes), the `./dev ack`/`./dev build` subcommands, the `SKILL.md` + the two workspace
launchers (`dev`/`dev.cmd`, not git-tracked in this repo), and the closing acceptance sweep against
spec/005 §6's 20-row table (stage 7 itself is accepted by rows #17/#18 alone per spec's own stage
breakdown, but an honest `SKILL.md` requires `main()` to actually work end-to-end first).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
