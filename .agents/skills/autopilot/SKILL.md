---
name: autopilot
description: "Run the SDLC pipeline at a chosen autonomy tier — L0 human-gated, L1 feature-branch, L2 verified staging, or L3 verified disposable sandbox. L2/L3 automation requires a documented target and rollback path. Wraps /design with tiered STOP points; it never bypasses human review or action authorization."
---

# Codex entrypoint for autopilot

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$autopilot` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/autopilot/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
