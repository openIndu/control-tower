---
date: 2026-10-18
slug: principle-lowercase-example-names
type: principle
related_spec: 004-principle-example-repo-names-lowercase
author: control-tower
pr: openIndu/control-tower#TBD
---

# Principle: the example repo names in RULE 7 and RULE 10 follow the lowercase rename

## Summary

The last two camel-case repo names in the sole rule source, `skills/principle/SKILL.md`, are lowercased: RULE 7 (aggregate repo `openindu-website`) and RULE 10 (`openindu-backend`'s `production_db`). Nothing else in the file changes: no RULE number, title, MUST / MUST NOT / CHECK item or meaning. The plugin version goes 5.4.2 -> 5.4.3 so that `/plugin update` picks it up.

This is a RULE text change, so it went through the `Principle modification process` (spec 004 drafted, two arbiter rounds, this record, a PR, a release). It is recorded as a declared deviation from RULE 5.1, see the verification record.

## Files involved

| File                                                        | Change   | Note                                                                                          |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/skills/principle/SKILL.md`  | modified | Two lines, letter case only: RULE 7 MUST item 4 (line 212) and RULE 10 WHEN (line 262).       |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json` | modified | Version 5.4.2 -> 5.4.3.                                                                       |
| `.claude-plugin/marketplace.json`                           | modified | Version 5.4.2 -> 5.4.3.                                                                       |
| `spec/004-principle-example-repo-names-lowercase.md`        | added    | The spec, `finalized` after arbiter review (round 1 `revision_required`, round 2 `approved`). |
| `spec/README.md`                                            | modified | Index row for spec 004.                                                                       |
| `revision/2026-10-18-principle-lowercase-example-names.md`  | added    | This record.                                                                                  |

## Trigger

User request on 2026-10-18 ("请帮我更新2,3"). control-tower#11 and #12 had lowercased every other repo name and left the principle file for this process on purpose (see `revision/2026-10-18-lowercase-remaining-repo-names.md`).

## Impact assessment

| Scope           | Note                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Affected agents | None behaviourally. The edited words are example identifiers, and they now match the `route.json` keys.                                                                             |
| Downstream sync | Through the plugin: `/plugin update openindu-control-tower@openindu` fetches 5.4.3.                                                                                                 |
| Rollback        | Revert the PR and bump to 5.4.4 inside the revert; otherwise installed copies never receive the rollback. The old spelling keeps resolving on GitHub, so nothing breaks in between. |

## Verification record

- [x] The five commands in spec 004 section 6 give the expected results (extracted from the spec and run verbatim; the outputs are in the PR description).
- [x] `npx prettier --check "**/*.md"` passed
- [x] arbiter review passed: round 1 `revision_required` (text fixes only), round 2 `approved`, both on 2026-10-18.
- [ ] RULE 5.1, declared deviation: the principle file is a prompt and 5.1 asks for an eval even for a one-character change. The repo has no eval harness (the model eval of at least 20 cases cannot be met per change) and the arbiter cannot waive a RULE, so the programmatic checks above stand in for it. Accepted by the maintainer through PR approval (to be ticked at merge).
- [ ] downstream repos synced (not applicable until consumers run `/plugin update`)
