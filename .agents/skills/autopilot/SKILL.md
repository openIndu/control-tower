---
name: autopilot
description: "Run the SDLC pipeline at a chosen autonomy tier — L0 human-gated, L1 feature-branch, L2 verified staging, or L3 verified disposable sandbox. L2/L3 automation requires a documented target and rollback path. Wraps /design with tiered STOP points; it never bypasses human review or action authorization."
---

Use as `$autopilot` in Codex. Only use on explicit `$autopilot` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/autopilot/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
