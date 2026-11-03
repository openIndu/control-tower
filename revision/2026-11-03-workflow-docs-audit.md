# Workflow documentation audit — 2026-11-03

## Scope

Audited the control-tower workflow inventory, user-facing command descriptions,
workflow execution contract, build/autopilot safety preconditions, principle
entry instructions, and current `AGENTS.md` adoption guidance.

## Changes

- Documented all 22 supported slash-command skills and clarified the boundaries
  between task stages, repository issue intake, organization issue intake,
  PR merge, image build, and infra-deploy publication.
- Clarified that the repository distributes these slash commands as a Claude
  Code plugin; `AGENTS.md` is shared guidance, not Codex-native registration.
- Required verified staging/sandbox deployment and rollback evidence before
  `/autopilot` L2/L3; removed inferred image registry targets from `/build`.
- Made `AGENTS.md` the primary adoption and role guidance file, retaining
  `CLAUDE.md` only as a legacy source to preserve where needed.
- Added a CI consistency check for skill directories, manifest entries,
  documented command inventories, and `/principle` startup instructions.

## Impact

No workflow identifier was added or removed. This is a documentation and guard
alignment change. The plugin version advances from 5.44.0 to 5.45.0.

## Verification

See the pull request checks for the workflow-doc consistency checker, formatting,
plugin validation, and workflow regression tests.
