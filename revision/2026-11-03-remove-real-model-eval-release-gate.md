# Remove mandatory real-model evaluation release gate — 2026-11-03

## Summary

Amend RULE 5.1 so a real-model evaluation is optional evidence rather than a
universal release precondition. Keep CI, relevant deterministic tests and
contract checks, applicable security scans, human review, explicit versioning,
production trace, and operational metrics as required controls. An evaluation
that is unavailable or blocked must be reported as `not run`, never as passed.

## Trigger and governance

The maintainer requested removal of the real-model evaluation blocker after
Anthropic returned `403 verification_required`. Spec 011 was reviewed by the
arbiter for all five required dimensions in three rounds; round 3 approved the
amendment. PR #114 was merged at 2026-11-03 12:02 UTC before this amendment was
implemented. This change does not retroactively alter that PR's review record.

## Files and impact

- `plugins/openindu-control-tower/skills/principle/SKILL.md`: revise RULE 5.1.
- `plugins/openindu-control-tower/evals/prompt-behavior/README.md`: document
  optional evaluation and the `not run` status.
- `spec/011-risk-tiered-prompt-validation.md` and `spec/README.md`: finalize and
  index the approved design.
- Plugin and marketplace manifests: bump from 5.49.0 to 5.50.0.
- Future prompt/toolchain changes follow the retained CI, security, deterministic
  contract, human-review, versioning, and trace gates; PR #114's merged status is
  unchanged.

No provider call, Gitee PR creation, production action, or change to RULE 4,
RULE 5.2, RULE 5.4, or RULE 7 is part of this implementation.

## Rollback

Revert the policy and documentation through a new PR and publish a new forward
plugin version. Preserve evaluation reports and traces. PR #114's merged status
is unchanged; keep affected future PRs in Draft if any required replacement
gate fails.

## Local verification

Passed locally: `git diff --check`, Prettier 3.9.10, workflow-documentation
consistency, Codex-entrypoint synchronization, plugin and marketplace strict
validation, and plugin-version increment check (5.49.0 to 5.50.0). Strict plugin
validation reports the pre-existing missing-icon warning. Tests and CI were not
run locally; PR CI remains the required check. No real-model evaluation was run.
