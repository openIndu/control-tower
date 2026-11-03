---
spec_id: 009-workflow-execution-gates
title: Workflow evidence, recovery and merge gates
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
---

# Workflow execution gates

## 1. Background (WHY)

The maintainer requested five corrections following independent workflow review:
missing stages, shared artifacts, unbound build evidence, unsafe recovery and an
undefined PR merge contract. The eight-command replacement is a separate scope;
the untracked spec/008 draft in another worktree is preserved.

## 2. Design points (WHAT)

- Ordered research/prod/dev/test evidence with objective local test fields.
- Repository/task identity, versioned artifact paths and evidence hashes.
- Exact tested checkout SHA and immutable registry digest handoff.
- Persistent repository lease, atomic checkpoints and write-ahead/read-back records.
- A separate read-only PR gate and serial merge workflow; no admin bypass.

## 3. Impact scope

Only control-tower plugin skills, two role prompts, one reference contract,
collector deduplication, CI test wiring and plugin metadata change. No business
repository, production system, finalized historical spec or principle is edited.

## 4. Implementation path (HOW)

1. Add deterministic helpers and task contract. Acceptance: ordered stages,
   invalidation, leases and write reconciliation pass regression cases. Rollback:
   revert the helper/contract changes; retain state files for diagnosis.
2. Connect existing workflows, add source and PR gates. Acceptance: stale source,
   missing manual evidence, non-openIndu owner, stale approvals, base changes and
   non-success required CI block execution. Rollback: revert new integrations.
3. Wire tests into CI and bump both plugin versions. Acceptance: format, plugin,
   route, roster and regression checks pass. Before publishing, split review units
   if the complete diff exceeds RULE 4. Rollback: revert release PRs in reverse order.

## 5. Rollback plan

Revert feature commits via new PRs. Do not delete task evidence or overwrite the
old engine branch. No external merge or deployment is exercised during testing.

## 6. Acceptance criteria

| Requirement                                | Executable verification                          |
| ------------------------------------------ | ------------------------------------------------ |
| Four stages and local validation mandatory | workflow-gates.test.mjs negative cases           |
| Task isolation and evidence integrity      | traversal, mutation and lease tests              |
| Source/test/build correspondence           | checkout/submodule/SHA and digest tests          |
| Recovery avoids duplicate writes           | lease/resume/intent/read-back tests              |
| Merge authorization stays current          | head/base/review/required-check/protection tests |
| Existing behavior retained                 | collector, hook, scope, route and roster checks  |

## 7. Principle self-check

| Dimension           | Assessment                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Principles          | No change to RULEs; no production writes; human review retained                                                       |
| Cross-repo contract | Distribution only; explicit task/state/build interfaces                                                               |
| Conflict            | 001 distribution and 007 roster preserved; old 005/006 engine untouched; new command does not consume standing grants |
| Minimal change      | Five related fixes; independently reviewable components; split before publishing if required                          |
| Rollback            | Revert PRs while preserving local task records                                                                        |

## 8. Open questions

No unresolved implementation decision. Full eight-command replacement and
non-container build support remain outside these five corrections.

## 9. Change log

| Date       | Change                                                                        | Revision                            |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| 2026-11-03 | Implementation approved after two arbiter rounds; local regression gates pass | 2026-11-03-workflow-execution-gates |
