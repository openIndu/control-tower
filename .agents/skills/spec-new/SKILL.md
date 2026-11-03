---
name: spec-new
description: Create a new spec design draft (feature / process improvement / principle evolution) in the control-tower repo, following spec/TEMPLATE.md with a 5-dimension self-check, then submit to arbiter for review. Cross-repo changes, principle edits, and new RULEs must go through this flow first (RULE 5).
---

# Codex entrypoint for spec-new

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

Only activate this workflow when the user explicitly invokes `$spec-new` or selects it in the skill picker; do not trigger it from inferred intent alone.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/spec-new/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
