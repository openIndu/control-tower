---
name: build
description: "Build and push a Docker image for an openIndu service. Part of RULE 11 step ④ — image build → push to Aliyun CR. Use after aggregate submodule PR merges, when a service's image needs rebuilding, or to verify a Dockerfile builds correctly before PR."
---

Use as `$build` in Codex. Only use on explicit `$build` invocation or skill-picker selection. Read the principles at `../../../plugins/openindu-control-tower/skills/principle/SKILL.md`, then follow the canonical workflow at `../../../plugins/openindu-control-tower/skills/build/SKILL.md`. Translate referenced Claude slash skills to their Codex `$name` forms; Codex does not register slash commands.
