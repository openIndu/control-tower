---
spec_id: 012-workflow-contract-clarity-and-coverage
title: Clarify workflow artifact, Issue coverage and autonomy contracts
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-11-03
updated: 2026-11-03
related_repos:
  - openIndu/control-tower
implementing_agents:
  - control-tower
related_rules:
  - RULE 2
  - RULE 3
  - RULE 4
  - RULE 5
  - RULE 7
---

# Clarify workflow artifact, Issue coverage and autonomy contracts

## 1. Background (WHY)

A review of the current workflow found ambiguity between `/design`'s legacy
`design/<domain>/` paths and the shared task-state artifact root; an organization
Issue snapshot can report complete when the API token silently omits private
repositories; L2/L3 autopilot wording can be read as allowing a merge without
the required current human review; and the plugin editing guide omits the Codex
version manifest. These gaps can cause lost evidence, incomplete backlog
coverage, or unsafe assumptions about merge authority.

## 2. Design points (WHAT)

- Distinguish canonical run evidence from optional repository design deliverables.
  Stage reports/checkpoints live in the task-isolated state root. A design
  deliverable committed to a repository is a named, versioned copy with its path
  and content hash recorded in task state; no shared `latest` path is used.
- For organization-wide `openIndu` Issue collection, compare API-visible
  repositories with the canonical GitHub repository inventory in plugin
  `reference/route.json`. Report missing and unexpected repositories. Any
  inventory mismatch or Issue-query error makes the snapshot incomplete and
  blocks organization-wide dispatch. Preserve single-repository operation.
- State explicitly that `/autopilot` tiers change workflow STOP points only.
  No tier merges a PR; current-head human review and all required checks remain
  prerequisites. GitOps auto-sync may happen only after a separately eligible,
  human-reviewed merge.
- Include the Claude plugin, Codex plugin, and marketplace manifests in the
  plugin-version maintenance instructions.
- Keep production apply human-only and avoid changes to risk authorization,
  branch protection, or RULE 5.2.

## 3. Impact scope

| Repository               | Files / modules                                                                                     | Owner               |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------- |
| `openIndu/control-tower` | design/autopilot/issue-pipeline skills, Issue collector, workflow docs, version manifests, revision | control-tower agent |

No downstream repository, GitHub Issue, PR, registry, Gitee repository, or
production system is written by this policy/implementation change.

## 4. Implementation path (HOW)

1. Finalize this spec through the arbiter's five-dimension review. Do not change
   normative workflow behavior if the arbiter rejects it. Roll back by discarding
   this unmerged branch.
2. Make `/design` distinguish task evidence under the shared state root from
   optional committed design deliverables. Record deliverable path/hash in the
   task state contract. Roll back through a revert PR.
3. Make the collector derive expected GitHub repositories from `route.json`,
   return coverage diagnostics and mark any inventory mismatch incomplete.
   Keep dry-run/read behavior and single-repository scope intact. Roll back the
   collector and its callers together.
4. Clarify tier and PR review language in `/autopilot`, `/design` and workflow
   summaries. Add Codex to version-update documentation. Roll back through a
   revert PR.
5. Bump all plugin manifests consistently, create a revision record, run
   applicable non-test static checks and rely on required PR CI for regression
   checks. Rollback by a new PR and forward plugin version.

## 5. Rollback plan

Revert the workflow docs/collector changes together through a new PR; do not
rewrite history. Restore prior behavior only with a forward plugin version.
Preserve task snapshots and evidence. If route coverage cannot be verified,
organization-wide Issue dispatch remains blocked while explicitly scoped
single-repository work remains available.

## 6. Acceptance criteria

| #   | Requirement                                                                                                       | Verification                                    |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `/design` distinguishes task-isolated run evidence from committed design deliverables and binds both by path/hash | Skill + execution contract review               |
| 2   | Missing or unexpected GitHub repos relative to `route.json` make an org snapshot incomplete with diagnostics      | Collector behavior and PR CI regression checks  |
| 3   | Single-repository Issue collection remains supported and rejects inaccessible target repos                        | Collector behavior and PR CI regression checks  |
| 4   | Autopilot tiers cannot bypass current human PR review, required CI, or merge authorization                        | Autopilot/design/pr_merge cross-document review |
| 5   | Plugin editing docs name all three version manifests                                                              | README review and version check                 |
| 6   | Plugin versions match and are incremented from main                                                               | `check-version-bump.mjs`                        |
| 7   | Format, documentation, route, plugin, and PR CI gates pass                                                        | Existing repository CI                          |

## 7. Principle self-check (arbiter review required)

| Dimension            | Assessment                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Principle compliance | Strengthens evidence coverage and existing human review; no auth gate is removed.                                                 |
| Cross-repo contract  | Limited to the openIndu control-tower plugin; downstream consumers update by plugin version.                                      |
| Conflict check       | Checked against finalized specs 009/010, workflow-execution, and current `/pr_merge`; no conflicting authorization is introduced. |
| Minimal change       | Four review findings only; preserve single-repo Issue collection and existing PR/release boundaries.                              |
| Rollback             | Revert through a new PR, preserve historical state, and publish a forward plugin version.                                         |

## 8. Open questions

None identified. The authoritative inventory for organization Issue coverage is
the GitHub-hosted entries in `reference/route.json`; Gitee-only entries are
excluded. Unexpected API-visible repositories intentionally block declaring the
snapshot complete until route ownership is reconciled.

## 9. Change log

| Date       | Change                                                               | Related revision                         |
| ---------- | -------------------------------------------------------------------- | ---------------------------------------- |
| 2026-11-03 | Drafted from the four findings in the workflow review.               | —                                        |
| 2026-11-03 | Finalized after arbiter round 1 approval across all five dimensions. | `2026-11-03-workflow-review-findings.md` |
