# Workflow gates split release — 2026-11-03

The maintainer authorized merging the reviewed fixes from PR #88. Its combined
diff failed RULE 4, so the implementation was separated by responsibility without
relaxing any checks or changing the reviewed runtime code.

| Component                                       | PR      | Verified before this final release PR         |
| ----------------------------------------------- | ------- | --------------------------------------------- |
| Durable state, evidence and Issue deduplication | #89     | CI passed; merged                             |
| Checkpoint-backed build source verification     | #90     | CI passed; merged                             |
| Guarded PR merge workflow and task contract     | #91     | CI passed; merged                             |
| Complete 58-case regression suite               | #92     | CI passed; merged                             |
| Existing workflow and role integration          | #93     | CI passed; merged                             |
| Build guidance, command indexes and spec 009    | This PR | Local checks passed; CI required before merge |

The complete regression suite from #88 is preserved under
`plugins/openindu-control-tower/evals/workflow-execution/`; only imports changed
for its new location. Three focused component test files were added for the
independently merged helpers. CI runs all of them and the existing engine tests.

The final plugin version is 5.37.0. The earlier local implementation report is
retained as a historical record. No production deployment or downstream plugin
update is implied. Revert component PRs in reverse dependency order if necessary,
preserving task evidence and journals. Close #88 as superseded only after remote
main content and all component merge results have been read back.
