---
name: test
description: Run unit and integration tests for an exact source SHA, manually start the local environment, perform interactive acceptance verification, retain evidence and clean up.
---

# Codex entrypoint for test

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$test` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/test/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
