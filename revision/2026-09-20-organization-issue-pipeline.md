---
date: 2026-09-20
slug: organization-issue-pipeline
type: agent
related_spec: —
author: control-tower
pr: openIndu/control-tower#TBD
---

# Organization-wide Issue intake and delivery pipeline

## Change summary

Issue #9 requested an end-to-end workflow that discovers all open Issues in the openIndu organization, identifies actionable work, challenges recommendations through multiple roles, and carries accepted work through implementation, review, PR, and green CI. The new `/issue-pipeline` skill adds that intake and queue layer while reusing `/autopilot` and `/delivery-check` for execution.

## Files

| File                                                        | Change  | Purpose                                                      |
| ----------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| `skills/issue-pipeline/SKILL.md`                            | added   | Structured triage, adversarial gate, dispatch, CI acceptance |
| `skills/issue-pipeline/scripts/collect-org-issues.mjs`      | added   | Deterministic organization/repository Issue collection       |
| `skills/issue-pipeline/scripts/collect-org-issues.test.mjs` | added   | Representative collector and signal tests                    |
| `agents/manager.md`                                         | updated | Route organization-wide Issue requests to the new skill      |
| plugin manifests and README                                 | updated | Register and publish plugin version 5.4.0                    |

## Trigger

- [openIndu/control-tower#9](https://github.com/openIndu/control-tower/issues/9)

## Impact

| Area               | Result                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Downstream users   | Receive `/issue-pipeline` after updating the plugin                                      |
| GitHub permissions | Read uses the caller's existing `gh` authentication; writes retain RULE 4 approval gates |
| Existing workflows | `/autopilot` and `/delivery-check` remain authoritative for implementation and delivery  |
| Rollback           | Revert the PR or install plugin version 5.3.2                                            |

## Verification

- [x] Collector unit/evaluation suite passes (25 representative cases)
- [x] Collector live dry-run returns `complete: true` (15 repositories, 1 Issue, 0 errors)
- [x] Plugin validation passes
- [x] Route sync and roster checks pass
- [x] Prettier check passes for every changed file
