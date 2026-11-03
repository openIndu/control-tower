# Control tower review gaps — 2026-11-03

## Summary

Bound manager decisions to ordinary workflow exceptions, added 20-case
prompt-behavior evaluation tooling, and strengthened CI with Codex wrapper sync,
Gitleaks, CodeQL, npm audit for pinned CI tools, Dependabot updates, and pinned
Prettier/Claude Code CLI versions. Main-branch review protection is unchanged per
the single-developer organization decision.

## Files involved

| File area                                                                          | Change                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `plugins/openindu-control-tower/agents/manager.md`, `team/README.md`, role indexes | Bound manager exception authority and documented human escalation              |
| `plugins/openindu-control-tower/evals/prompt-behavior/`                            | Added 20 synthetic cases, behavior runner, and zero-model-call contract checks |
| `.github/workflows/ci.yml`, `.github/dependabot.yml`                               | Added wrapper sync, security/dependency scans, and pinned CI tooling           |
| Plugin manifests                                                                   | Bumped Claude, Codex, and marketplace versions to 5.48.0                       |

## Trigger and impact

Triggered by the multi-agent review of open PRs #109/#110. The 20-case model
evaluation was attempted with Claude Code CLI 2.1.317 and model
`claude-sonnet-5`, but Anthropic returned `403 verification_required` before
processing any cases (0 input/output tokens and USD 0 reported). The runner and
case set are ready to rerun after account verification; no prompt-eval pass is
claimed in this record.

## Verification

- [x] Prompt contract suite: 3/3 passed; includes the 20-case fixture integrity check.
- [x] Codex wrappers match 22 canonical skills.
- [x] Roster check: 20/20.
- [x] Prettier and `git diff --check` passed.
- [ ] Live model behavior evaluation: blocked by provider account verification.
- [ ] CI security scans and plugin validation: pending the PR workflow run.
