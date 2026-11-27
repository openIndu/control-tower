## Summary

- Add SM-1 to RULE 4 for per-task, sole-owner approval of isolated local/test permission-code authoring with synthetic disposable data.
- Explicitly exclude push, merge, deployment, staging/production changes, live-user role assignment, production data/configuration, external grants, and irreversible actions.
- Preserve maintainer review and required CI before merge; keep spec/006 SA-1 limited to standing merge authorization.
- Add seven evaluation scenarios and deterministic contract checks; bump plugin manifests to 5.53.0.

## Review and verification

- Arbiter review: round 1 revision required; round 2 approved.
- `node --test plugins/openindu-control-tower/evals/prompt-behavior/*.test.mjs` — 5/5 passed.
- `npx prettier --check "**/*.md"` — passed.
- Strict plugin and marketplace validation — passed (plugin validator reported the existing missing-icon warning; validation still passed).
- Codex skill sync, route sync, roster checks, and plugin version bump check — passed.
- Real-model prompt evaluation — not run.

## Scope

This PR changes governance documentation and evaluation assets only. It does not change runtime permissions, user roles, database state, or deployments.
