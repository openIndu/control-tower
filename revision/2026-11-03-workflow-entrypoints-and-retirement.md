---
date: 2026-11-03
slug: workflow-entrypoints-and-retirement
type: manifest | docs | ci
related_spec: 010-workflow-entrypoints-and-retirement
author: control-tower
pr: openIndu/control-tower#97, #98, #99, #101, #103, #104, #105
---

# Workflow entrypoints and legacy dev retirement

## Summary

Shipped `/research`, `/prod`, the replacement task-scoped `/dev`, `/test`,
`/publish`, `/dev_issue`, and the publication journal recovery tests. Revoked
SA-1 and removed the legacy dev runner, engine, schema, and superseded evals.
Updated the skill registry, CI and repository command indexes to describe the
current 22-skill surface. Specs 005 and 006 remain preserved as superseded history.

## Change record

- #97 added research and product entrypoints.
- #98 replaced the old dev entry and preserved the old runner's 59 tests until
  the full engine retirement in #105.
- #99 added local test and repository-scoped Issue workflows.
- #101 added the infra-deploy publication workflow and independently leased journal.
- #103 reverted SA-1, removed standing grants and superseded specs 005/006.
- #104 added seven publication journal recovery cases.
- #105 removed the engine and the obsolete dev/authorization eval suites while
  retaining the workflow-execution evals.

## Impact and rollback

Changes affect only `openIndu/control-tower`. No downstream repository, image,
GitOps manifest or production cluster was changed. Revert the relevant PRs to
roll back individual components; restore the engine only if the old workflow is
deliberately reintroduced through a new approved spec.

## Verification

- All listed implementation PRs were merged after CI passed and head SHA was
  checked at merge time.
- The current workflow-execution suite passed 98 cases before the final deletion
  PR; the publication-specific suite passed 7 cases and is retained in CI.
- Hook, issue collector, checkpoint, build-source, merge-gate and scope tests passed.
- Route source/mirror, plugin version and scope checks passed.
- Production apply and downstream plugin rollout were not part of these PRs.
