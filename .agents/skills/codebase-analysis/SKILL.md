---
name: codebase-analysis
description: 'Use when analyzing, reverse-engineering, onboarding to, or documenting any large codebase. Triggers on requests like "分析这个项目", "explain the architecture", "trace the call stack", "how does X work", "code review", or when needing to understand an unfamiliar codebase before making changes. Follows a 7-step logical flow: problem → features → components → code deep-dive → architecture → 4+1 view → markdown output.'
---

# Codex entrypoint for codebase-analysis

This skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.

1. Read and follow the authoritative principles in `plugins/openindu-control-tower/skills/principle/SKILL.md` before any task action.
2. Read and follow the canonical workflow instructions in `plugins/openindu-control-tower/skills/codebase-analysis/SKILL.md`.
3. When the workflow calls another slash command, use that skill by its Codex name (for example, `$route`) or read its canonical `SKILL.md`; Codex does not register Claude-style slash commands.
