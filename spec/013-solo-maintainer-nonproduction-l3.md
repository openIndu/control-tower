---
spec_id: 013-solo-maintainer-nonproduction-l3
title: Solo maintainer authorization for non-production L3 changes
status: finalized
author: control-tower
created: 2026-11-11
updated: 2026-11-11
supersedes:
related_repos:
  - control-tower
  - openindu-backend
  - openindu-admin
  - openindu-portal
implementing_agents:
  - control-tower
  - backend
  - frontend
related_rules:
  - RULE 4
  - RULE 5
---

# Solo maintainer authorization for non-production L3 changes

## 1. Background (WHY)

RULE 4 currently requires dual approval for all L3 actions, including permission changes. The organization has one maintainer/developer, so an independent second human approver may not exist. The already-finalized spec/006 exception covers only standing merge authorization; it does not cover other L3 work. This prevents the owner from explicitly authorizing local development changes to authentication and role models even when no production system or real user access is changed.

The trigger is the requested account-role redesign: professional membership and supplier access must be represented as roles bound to a user, and the portal/backend authorization must follow those roles. This is a security-sensitive code change, but the current work is confined to local development and is directly authorized by the sole project owner.

## 2. Design points (WHAT)

- Add a narrowly scoped RULE 4 exception allowing the sole project owner to approve implementation of an L3-sensitive code change only on an isolated local/test feature branch with synthetic data. This exception permits authoring and local verification only.
- The exception never authorizes merging, pushing, deployment, production/staging changes, live-user role assignment, production data/configuration changes, external access grants, or irreversible actions. These remain subject to existing approval and review rules; uncertain isolation means stop.
- Treat the project owner's explicit statement in the task thread as the source of truth for the single-maintainer context for that one local task. Record the approver, exact target/environment, scope/diff, synthetic-data assertion, rollback, and date in a task approval record. Do not create a standing grant or infer approval from ownership.
- The agent must still escalate and may not infer approval from project ownership, prior approvals, or the solo-maintainer status. The agent may implement only after the maintainer's explicit approval for that specific change.
- Preserve RULE 5.2: the maintainer must inspect the resulting diff and required CI must pass before any PR merge. Independent agent review can veto or identify defects but cannot be counted as a second human approver, satisfy human review, or authorize production.
- If the target, blast radius, rollback, or production isolation is uncertain, the exception does not apply and work stops for human clarification.

## 3. Impact scope

| Repository       | Files / modules                                                                                                                             | Owner         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| control-tower    | Principle RULE 4; spec index; revision record; plugin version metadata and generated Codex discovery metadata if required by release checks | control-tower |
| openindu-backend | None in this governance change; separate role redesign implementation after the rule is finalized                                           | backend       |
| openindu-admin   | None in this governance change; separate role UI implementation after the rule is finalized                                                 | frontend      |
| openindu-portal  | None in this governance change; separate role UI implementation after the rule is finalized                                                 | frontend      |

## 4. Implementation path (HOW)

### Phase 1 — Draft and independent review

- Start: this spec is `draft`; control-tower branch is clean before the spec branch.
- Change: submit to arbiter for review on principle compliance, cross-repo contract, finalized-spec conflicts, minimal scope, and rollback.
- Acceptance: arbiter approves, or requested revisions are completed within three rounds; no principle text is changed before approval.
- Rollback: close the draft and delete only this unfinalized spec branch if rejected; no distributed rule or runtime behavior changes.

### Phase 2 — Finalize and revise principle

- Start: arbiter approval recorded.
- Change: mark this spec finalized, index it, update RULE 4 with the bounded exception, append a revision record, bump plugin/marketplace versions, and update any generated discovery metadata required by repository checks.
- Acceptance: strict plugin validation, formatting, route/roster/version checks pass; the published principle clearly distinguishes sole-owner non-production approval from production dual approval.
- Rollback: revert the governance PR and bump the plugin version again; downstream copies retain the previous rule until refreshed.

### Phase 3 — Apply to the account-role task

- Start: the finalized rule is available in the authoritative control-tower source; a task approval record identifies the owner, local feature branches, exact scope, rollback, and environment; no production credentials/endpoints are configured for the task; any local data verification uses disposable synthetic data only.
- Change: implement the user-role binding and account/workbench behavior in backend, admin, and portal on local feature branches. Do not merge, push, deploy, grant live roles, or change production data/configuration under this exception.
- Acceptance: role payload and endpoint authorization agree; unauthorized and authorized cases are verified using synthetic data; the owner inspects the complete diff and required CI passes before any PR merge under the ordinary rules. Production deployment and live-user role grants remain out of scope.
- Rollback: revert the implementation changes and migration using the implementation's reviewed rollback procedure; preserve local database state before applying migration.

## 5. Rollback plan

The governance change is reversible by reverting its PR and publishing a higher plugin version with the prior RULE 4 wording. No role assignments, database changes, deployments, or live permissions are changed by this spec. The subsequent account-role implementation is a separate change with its own migration rollback and local-only boundary. If an environment or data set cannot be confirmed as isolated and synthetic, do not use the exception.

## 6. Acceptance criteria

| #   | Criterion                                                                                                             | Executable verification                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Exception permits only local/test implementation work on an isolated feature branch using synthetic data              | RULE 4 text and eval cases reject staging, production credentials/endpoints, and non-synthetic data                                              |
| 2   | Exception never authorizes merge, push, deploy, live role assignment, production data/config, or irreversible actions | Eval cases for each action must return escalate/blocked under the exception                                                                      |
| 3   | Approval is explicit and recorded per task                                                                            | Task record includes approver, target/environment, diff/scope, synthetic-data assertion, rollback, and date; missing fields block implementation |
| 4   | Maintainer review and existing production L3 controls stay in force                                                   | Rule text preserves RULE 5.2 and RULE 7; production dual-approval cases remain unchanged                                                         |
| 5   | Plugin artifacts remain internally consistent                                                                         | Run prettier check, strict plugin validation, route/roster/version checks, and relevant principle evals                                          |

## 7. Principle self-check

| Dimension                     | Self-check conclusion                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principle compliance          | The exception only permits code authoring and local verification on an isolated feature branch with synthetic data. It does not permit merge, push, deployment, live role assignment, production data/config, or irreversible actions. RULE 5.2 human review, RULE 7 branch protection, RULE 5.4 security controls, and RULE 7–11 remain in force. |
| Cross-repo contract           | No runtime API contract changes in the governance phase. The later role implementation must define backend role binding, auth response shape, authorization dependencies, and frontend visibility against one shared contract.                                                                                                                     |
| Conflict with finalized specs | Checked spec/006 and revision `2026-10-28-standing-authorization-sa1-clause.md`: their single-maintainer exception is limited to standing merge authorization and explicitly excludes L3/security changes. This proposal does not broaden SA-1 or authorize merge. Also checked finalized specs 009–012 for workflow gate conflicts.               |
| Minimal change                | One control-tower principle rule and its versioned distribution metadata; business role changes remain a separate implementation task.                                                                                                                                                                                                             |
| Rollback path                 | Revert the control-tower PR, bump the plugin version, and keep the role implementation unstarted until the finalized rule is available.                                                                                                                                                                                                            |

## 8. Open questions

- No open questions remain. Sole-maintainer context is declared by the owner per task in its approval record. Eligibility is limited to local/test code authoring with synthetic disposable data; staging and every merge/deploy/live-data action remain outside the exception.

## 9. Change log

| Date       | Change                                                                                                                        | Related revision |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 2026-11-11 | Initial draft after maintainer requested a workable single-developer approval process for local permission-model development. | —                |
