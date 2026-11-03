# Workflow execution gates — 2026-11-03

## Summary

Address the maintainer's five workflow review findings: mandatory stage evidence,
task isolation, tested source binding and registry read-back, durable recovery,
and serial PR merge eligibility. No principle or historical finalized spec changed.

## Files

- Plugin reference/workflow-execution.md and workflow-state.mjs: stage/state contract.
- Existing design/autopilot/issue-pipeline and business/product roles: integrations.
- Build source helper and skill: source verification and registry evidence.
- pr_merge skill/checker: current approval, strict CI protection and merge read-back.
- Collector deduplication, regression cases, CI wiring and plugin version metadata.

## Trigger

User requested fixes following three-agent review on 2026-11-03. Spec 009 records
the design; no actual product build, registry push or PR merge is a test action.

## Impact and rollback

Only the control-tower plugin changes. Feature commits can be reverted via PR;
preserve task state and journals. Do not claim downstream adoption until the
release merges and consumers update. Verification results are recorded in the
implementation report; the regression suite has at least 20 distinct cases.

## Independent review

Arbiter `review_workflow_fixes` approved the implementation in round 2 on
2026-11-03 after correcting dry-run, operation identity, absent-write read-back,
check diagnostics, junction isolation and checkpoint-backed build evidence.
This approval covers local design/implementation; it is not a release or merge approval.

## Local verification

- 102 related regression cases passed (58 new workflow cases plus collector, hook and scope tests).
- 529 existing engine/runner cases passed; no skipped or failed cases.
- Markdown format, route synchronization, roster and plugin validation passed.
- Plugin validation reports the existing missing-icon warning; no icon changes were made.
- Five acceptance fields are locally verified: ordered stages, isolated artifacts,
  tested source binding, durable write reconciliation, and current merge evidence.
- Branch: `fix/workflow-execution-gates`; release/PR splitting and downstream adoption
  have not been performed by this implementation task. No product build or merge was executed.
