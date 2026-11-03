# Codex skill distribution — 2026-11-03

## Scope

Add Codex-discoverable entrypoints for the canonical openIndu control-tower
skills while retaining the Claude Code slash-command distribution.

## Changes

- Add `.codex-plugin/plugin.json` pointing to the existing canonical skill tree.
- Add repo-local `.agents/skills/<name>/SKILL.md` entrypoints for all 22 skills.
- Add Codex invocation guidance to canonical skill files: use `$name` in Codex;
  Claude Code continues to use `/name`.
- Add `scripts/sync-codex-skills.mjs` to generate the thin repo-local entrypoints.
- Document the client-specific invocation syntax and bump the shared plugin
  version to 5.46.0.

## Impact

Codex users can discover the skills in this repository or install the Codex
plugin package for use in another repository. Codex does not create literal
Claude-style slash commands.

## Verification

The sync script generated the 22 local entrypoints and confirmed they match the
canonical skill names and Codex manifest. The pull request CI remains the
release gate.
