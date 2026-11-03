---
spec_id: 010-workflow-entrypoints-and-retirement
title: Complete legacy dev retirement and six workflow entrypoints
status: finalized
author: control-tower
created: 2026-11-03
updated: 2026-11-03
related_repos:
  - openIndu/control-tower
implementing_agents:
  - control-tower
related_rules:
  - RULE 3
  - RULE 4
  - RULE 5
  - RULE 7
  - RULE 8
  - RULE 11
---

# Complete legacy dev retirement and six workflow entrypoints

## 1. Background (WHY)

PR #84's retirement remains open while spec 009's evidence/recovery helpers and
`/pr_merge` are on main. The maintainer requests completing that retirement and
adding `/research`, `/prod`, a plain implementation `/dev`, `/test`, `/publish`
and repository-scoped `/dev_issue`. The untracked spec 008 draft is preserved;
this design uses the current spec 009 contract and current authorization rules.

## 2. Design points (WHAT)

- Add six independently callable skill files with explicit inputs, outputs,
  risk boundaries, dry-run behavior and versioned task artifacts.
- A deterministic request preflight checks owner/route, task identity, prerequisite
  evidence/hashes, test SHA and publish digest before a workflow acts.
- Research distinguishes released features, public roadmap and unknowns; product
  translates differentiation into testable acceptance. Missing advantage can stop work.
- Dev implements one accepted task; test runs UT/IT, starts the actual local
  environment, performs interactive acceptance and cleans up. Neither merges.
- Publish prepares an English infra-deploy PR using the verified build digest;
  production apply remains human-only. Dev_issue enumerates one repository,
  performs triage and four stages, and stops at verified green PRs.
- Publishing keeps source/test/build evidence in the product task, acquires an
  independent infra-deploy lease, and uses a separate Gitee publication journal.
  Intent/read-back bind source task/SHA/digest, infra branch/head SHA, Gitee PR
  ID/URL, actual SHA/digest and errors. Uncertain writes require reconciliation;
  the existing GitHub reconciler's URL restriction is not widened.
- Retire old runner/carrier/grants/schema/evals without removing spec 009's
  helpers or tests. The four principle-text reversions and empty grant removal
  use spec 006 section 5's explicit prior authorization.
- Keep existing orchestration entrypoints available as compatibility consumers of
  spec 009; do not extend this task into deleting unrelated skills.

## 3. Impact scope

Only control-tower plugin, CI, routing sync, command indexes, spec status markers
and revision records change. No downstream repositories or production systems
are written. Future workflow execution must restrict writes to openIndu targets.

## 4. Implementation path (HOW)

1. Prepare recursive CI discovery of legacy tests while their modules exist.
   Acceptance: every current test remains selected. Rollback: revert CI PR.
2. Add preflight and at least 20 scenario assertions, then research/product entries.
   Acceptance: malformed requests and missing/stale prerequisites are rejected.
   Rollback: revert each independent addition.
3. Replace dev's public entry, relocate the runner/tests/schema into the legacy
   engine using preserved relative imports, then delete the complete engine and
   its two old eval suites. Acceptance: transitional tests pass; generic helpers
   remain; final tests have no import from deleted code. Rollback: reverse PRs.
4. Revert the four authorized principle additions and remove route grant/dev
   data together; add a revision. Acceptance: no live grant semantics, route sync
   passes. Rollback: restore the prior plugin version through a PR.
5. Add test/publish/dev_issue and refresh manifest/indexes. Acceptance: all eight
   requested commands exist, meaningful gates/evals pass and CI is green for
   every bounded component PR. Close #84 only after authoritative read-back.

## 5. Rollback plan

Revert component PRs in reverse dependency order; restore runner and tests together
if required. Preserve task evidence/journals. Never delete historical finalized
spec content; mark 005/006 superseded with a dated note and changelog only.

## 6. Acceptance criteria

| Target          | Expected                                                              | Verification                                        |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| Retirement      | No engine, old dev scripts/schema, legacy eval suites or route grants | Git tree and targeted live-source search            |
| Six entries     | Research/prod/dev/test/publish/dev_issue are callable and documented  | Skill registry plus scenario contract tests         |
| Evidence        | Ordered prerequisites and hashes, source/digest binding               | Negative and positive preflight cases               |
| Research        | Competitor features, roadmap, differentiation and actions             | Skill contract assertions and artifact requirements |
| Local test      | UT/IT/local/manual/cleanup evidence mandatory                         | Existing and new regression suite                   |
| Publishing      | Only infra-deploy PR; English metadata; no agent apply                | Target checks and skill contract cases              |
| Issue execution | One repo, deduplication, resume, four stages, PR read-back            | Collector/state/preflight and entry assertions      |
| Distribution    | Matching incremented versions, no weakened checks                     | Version/scope/plugin/route/roster CI                |

## 7. Principle self-check

| Dimension      | Assessment                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Principle      | 11 RULEs preserved; only spec 006 section 5's authorized revert                                                |
| Cross-repo     | Task schema v1, explicit build/publish handoff, GitHub versus Gitee                                            |
| Conflict       | 001 distribution and 007 roster retained; 009 helpers retained; 005/006 retired as maintainer requested        |
| Minimal change | Independent components below 400 lines, or complete deletion of one module; version catalogs stay synchronized |
| Rollback       | Reverse PRs; no production data/deployment operation                                                           |

## 8. Open questions

None. Research uses current external sources when needed, with citations and date;
dry-run performs reads/planning only. Existing explicit authorization persists;
the workflows do not manufacture approval or require it again without cause.
Evaluation records deterministic case counts, elapsed time and zero LLM cost,
comparing the existing spec 009 regression baseline before/after retirement.
Prompt contract assertions supplement executable request, artifact-integrity
and publication-recovery scenarios; they do not establish model output quality.

## 9. Change log

| Date       | Change                                                                            | Revision               |
| ---------- | --------------------------------------------------------------------------------- | ---------------------- |
| 2026-11-03 | Approved after two arbiter rounds; independent Gitee publication journal required | retirement-and-entries |
