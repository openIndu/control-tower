---
name: delivery-check
description: 'Generate and check the RULE 11 delivery-pipeline completeness checklist (sub-repo PR → merge → aggregate submodule → image build → infra-deploy PR → kubectl apply). Must run before reporting any openIndu bug fix / feature complete, to prevent "applied but not live".'
---

# Codex entrypoint for delivery-check

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/delivery-check/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
