# Arbiter decision record

## Round 1 ? revision_required

- Principle compliance: restrict the exception to isolated local/test code authoring; explicitly exclude merge, push, deployment, live role assignment, production data/configuration, and uncertain isolation. Preserve RULE 5.2 human review and CI.
- Cross-repo contract: record approver, target environment, scope/diff, rollback, date, and how isolation is verified.
- Conflict check: keep spec/006 SA-1 limited to standing merge authorization; preserve RULE 5.2 and RULE 7.
- Minimality: resolve the source of sole-maintainer evidence and exclude staging with real data.
- Rollback: do not start implementation before the rule is finalized.

## Round 2 ? approved

The revised spec limits the exception to code authoring and local verification on isolated local/test feature branches with synthetic disposable data. It excludes merge, push, deployment, staging/production changes, live role grants, production data/configuration, external grants, and irreversible actions. It requires per-task owner approval evidence and preserves human review and required CI before merge. It does not broaden spec/006 SA-1. No blocking findings remain. The arbiter requested that deterministic cases for each hard exclusion be added and run before finalizing the rule.
