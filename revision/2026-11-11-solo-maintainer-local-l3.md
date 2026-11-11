---
date: 2026-11-11
slug: solo-maintainer-local-l3
type: principle
related_spec: 013-solo-maintainer-nonproduction-l3
author: control-tower
pr: pending
---

# Allow sole-owner approval for isolated local permission-code work

## Summary

Adds SM-1 to RULE 4 so a sole project owner can explicitly approve one isolated local/test code-authoring task using synthetic disposable data. The exception does not authorize push, merge, deployment, staging or production changes, live-user role assignment, external grants, or irreversible actions. The ordinary human review, CI, and production gates remain in force.

## Files involved

| File                                                                              | Change   | Note                                                                 |
| --------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| `plugins/openindu-control-tower/skills/principle/SKILL.md`                        | modified | Adds bounded SM-1 exception to RULE 4.                               |
| `plugins/openindu-control-tower/skills/autopilot/SKILL.md`                        | modified | Aligns autopilot wording with the exception and exclusions.          |
| `plugins/openindu-control-tower/evals/prompt-behavior/cases.json`                 | modified | Adds seven SM-1 cases covering allowed work and excluded actions.    |
| `plugins/openindu-control-tower/evals/prompt-behavior/workflow-contract.test.mjs` | modified | Adds deterministic assertions for case coverage and rule boundaries. |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`                       | modified | Bumps plugin version to 5.53.0.                                      |
| `.claude-plugin/marketplace.json`                                                 | modified | Keeps marketplace version aligned at 5.53.0.                         |
| `.codex-plugin/plugin.json`                                                       | modified | Keeps Codex manifest version aligned at 5.53.0.                      |
| `spec/013-solo-maintainer-nonproduction-l3.md`                                    | added    | Arbiter-approved governance design.                                  |
| `spec/README.md`                                                                  | modified | Adds finalized spec 013 to the index.                                |
| `threads/013-solo-maintainer-nonproduction-l3/`                                   | added    | Stores request, owner approval, and arbiter decisions.               |

## Trigger

The project owner stated that the project has one developer and explicitly approved adapting the process so local permission-model development can proceed. The change was designed in spec 013 and approved by the arbiter in review round 2 after a revision-required decision in round 1.

## Impact assessment

| Scope           | Note                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Affected agents | All agents loading the authoritative principle; autopilot now states the same limits.                                                                                        |
| Downstream sync | Required after the control-tower PR merges: plugin release 5.53.0 must be installed in downstream workspaces.                                                                |
| Rollback method | Revert the governance PR and publish a higher plugin version with the previous RULE 4 text. No runtime role, data, or permission state is changed by this governance update. |

## Verification record

- [x] `npx prettier --write` formatted the spec, review request, owner approval, and arbiter decision files.
- [x] `node --test plugins/openindu-control-tower/evals/prompt-behavior/workflow-contract.test.mjs` passed 5/5 tests, including all seven SM-1 boundary scenarios.
- [ ] Strict plugin validation, Codex synchronization, route/roster/version checks pending.
- [ ] Downstream repos synced after PR merge.
