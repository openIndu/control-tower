---
spec_id: 011-risk-tiered-prompt-validation
title: Remove mandatory real-model evaluation as a release gate
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

# Scope RULE 5.1 model-evaluation gates to behavior-changing updates

## 1. Background (WHY)

The current RULE 5.1 makes a passing real-model evaluation a universal release
precondition for any changed agent, prompt, or toolchain. This blocks control-
tower PR #114, which updates `/publish` to use the authenticated Gitee CLI,
because the Anthropic account returned `403 verification_required` before any
scenario was scored.

The maintainer asks to remove the requirement that real-model evaluation must
pass before a prompt or toolchain change can go live. Validation remains
mandatory through CI, relevant deterministic tests/contracts, security checks,
human review, versioning, and production trace. Real-model evaluation can still
be run and recorded, but its absence or provider failure is not itself a release
blocker.

## 2. Design points (WHAT)

- Remove the MUST that real-model evaluation pass before any prompt/toolchain
  change goes live. A real-model evaluation is optional evidence and must never
  be reported as passed when it was not run or could not complete.
- Keep validation mandatory: CI, security scans, relevant deterministic tests or
  contract checks, human review, versioned artifacts, and production trace.
  Prompt/toolchain changes must list affected behavior and include representative
  scenarios with expected outcomes; use programmatic assertions where the
  behavior can be expressed deterministically. No change may ship on “looks
  fine” alone.
- When a real-model evaluation is available, record its model/prompt/tool
  versions, case set, pass rate, regressions, performance and cost. A provider
  verification failure is recorded as not run; it does not replace or weaken the
  required deterministic, security, or human-review gates.
- Keep RULE 5.1's trace, production metrics, and explicit model/prompt/tool
  version requirements where applicable.
- A governance change to RULE 5.1 itself is validated by the dedicated principle
  amendment process: spec, five-dimension arbiter review, explicit maintainer
  authorization, CI, revision record, and a versioned PR release. This process
  is the validation path for the normative amendment itself; it does not bypass
  validation for later operational changes.
- After this amendment is merged and released, PR #114 may use the replacement
  gates above. It still requires passing CI, security checks, relevant contract
  validation, and human review; provider evaluation failure must be recorded,
  not presented as a pass.

## 3. Impact scope

| Repository               | Files / modules                                                                                           | Owner               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------- |
| `openIndu/control-tower` | `principle/SKILL.md`, `/publish`, relevant validation/evaluation docs, version manifests, revision record | control-tower agent |

This change does not alter main-branch approval settings, RULE 4 authorization,
RULE 5.2 human review, RULE 5.4 credential handling, or RULE 7 branch protection.
PR #114 was merged at 2026-11-03 12:02 UTC before this amendment was
implemented; this amendment does not retroactively change its review record.
No Gitee PR or production manifest is created by the policy change itself.

## 4. Implementation path (HOW)

1. Finalize this spec through the arbiter's five dimensions. The principle
   amendment itself uses the dedicated governance validation path listed in
   section 2. Rollback: do not implement if the arbiter rejects the change.
2. Replace RULE 5.1's real-model pass gate with the mandatory evidence and
   reporting requirements in section 2. Keep CI, deterministic checks, security
   scans, human review, versioning, and trace intact. Rollback: restore the prior
   principle text through a new PR and issue the next plugin version.
3. Update `/publish` validation documentation to distinguish “passed,” “failed,”
   and “not run” model-evaluation states. Keep Gitee CLI target/auth/duplicate/
   read-back and journal gates intact. Rollback: revert the documentation with
   the principle change.
4. Add or update relevant deterministic workflow contract checks, bump plugin
   versions, record the revision and create a PR. Tests must cover the new
   validation boundary without making a real model call or creating a real Gitee
   PR. Rollback: revert via PR and increment forward.
5. Apply these rules to future prompt/toolchain changes after this amendment is
   merged and released. PR #114's already-merged review record is unchanged.
   Rollback: keep affected future PRs in Draft if CI, contract, security or
   review gates fail.

## 5. Rollback plan

Revert the RULE and implementation changes through a new PR; do not rewrite
history or decrease a published plugin version. If a prompt/toolchain change
causes an incident or contract failure, pause further rollout, preserve trace and
journal evidence, revert the affected operational change through a PR, and then
reassess the rule text. Keep affected future PRs in Draft until the amendment and
their replacement validation checks are merged.

## 6. Acceptance criteria

| #   | Requirement                                                                                                       | Verification                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Real-model evaluation is no longer a mandatory pre-live pass gate                                                 | Principle text review and validation-contract checks                  |
| 2   | CI, security scans, relevant deterministic checks, human review, versioning, and production trace remain required | Principle diff and CI                                                 |
| 3   | An unrun or provider-blocked evaluation is reported as `not run`, never as passed                                 | Workflow docs and eval-report contract                                |
| 4   | `/publish` still enforces Gitee CLI target/auth/duplicate/read-back/journal gates                                 | Workflow contract checks                                              |
| 5   | The RULE amendment itself passes the required governance process and ordinary CI before release                   | Arbiter review, maintainer authorization, version and revision checks |
| 6   | RULE 4, RULE 5.2, RULE 5.4, and RULE 7 remain unchanged                                                           | Principle diff review                                                 |
| 7   | Version metadata and rollback are traceable                                                                       | Version-bump check, revision record, and PR history                   |

## 7. Principle self-check (arbiter review required)

| Dimension            | Assessment                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Principle compliance | Proposed change is to RULE 5.1 itself. It removes only the mandatory real-model pass condition while retaining CI, relevant tests, security scans, human review, versioning and trace. The amendment uses the dedicated governance process. No other RULE is intentionally weakened. |
| Cross-repo contract  | Limited to the control-tower plugin; `/publish` continues to target only `openIndu/infra-deploy`.                                                                                                                                                                                    |
| Conflict check       | Must be checked against finalized specs 009 and 010 and the current RULE 5.1 before finalization.                                                                                                                                                                                    |
| Minimal change       | Removes only the real-model pass requirement; other release gates remain. PR #114 merged before implementation and is not retroactively changed.                                                                                                                                     |
| Rollback             | Revert by a new PR and forward plugin version; keep affected future PRs Draft until the policy is finalized and required checks pass.                                                                                                                                                |

## 8. Open questions

None. Arbiter round 3 approved the retained validation controls and the
governance validation path for this amendment.

## 9. Change log

| Date       | Change                                                                                                                                                                                                | Related revision                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 2026-11-03 | Initial draft after the user requested removing the real-model evaluation blocker for PR #114.                                                                                                        | —                                                   |
| 2026-11-03 | Revised after arbiter round 1: deterministic changes require code-owned action construction; added CLI version/auth contract and governance validation for the RULE amendment itself.                 | —                                                   |
| 2026-11-03 | Revised after arbiter round 2 and the maintainer's clarification: remove real-model evaluation as a universal release gate; retain CI, tests/contracts, security, human review, versioning and trace. | —                                                   |
| 2026-11-03 | Finalized after arbiter round 3 approval across all five dimensions.                                                                                                                                  | `2026-11-03-remove-real-model-eval-release-gate.md` |
| 2026-11-03 | Clarified that PR #114 had merged before implementation; the amendment is prospective and does not rewrite its review record.                                                                         | `2026-11-03-remove-real-model-eval-release-gate.md` |
