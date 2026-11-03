---
name: delivery-check
description: 'Generate and check the RULE 11 delivery-pipeline completeness checklist (sub-repo PR → merge → aggregate submodule → image build → infra-deploy PR → kubectl apply). Must run before reporting any openIndu bug fix / feature complete, to prevent "applied but not live".'
---

Use as `$delivery-check` in Codex. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/delivery-check/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
