---
date: 2026-10-18
slug: lowercase-repo-names-in-route
type: route
related_spec: —
author: control-tower
pr: openIndu/control-tower#11
---

# Route: follow the GitHub rename of six repos to all-lowercase names

## Summary

On 2026-10-17 (13:16-13:19 UTC) six org repos were renamed on GitHub from camelCase to all-lowercase: `openIndu-studio`, `openIndu-website`, `openIndu-portal`, `openIndu-backend`, `openIndu-platform` and `openIndu-admin` became `openindu-*` (`openindu-station` already was). GitHub redirects the old URLs, so nothing is unreachable, but the CI step `route.json covers every org repo` compares repo names case-sensitively against `gh repo list`: with the old keys it reports `openindu-website`, `openindu-portal`, `openindu-backend` and `openindu-admin` (the public repos visible to the default CI token; six with an org-read token) as missing from `route.json`. This change renames the six route keys and their `url`s, the references to them (`aggregate`, `submodules`, `release_flow` text), and the matching names in the `route` and `delivery-check` skills, and rewrites the known-data-issue note that still described camelCase as the org convention.

## Files involved

| File                                                            | Change   | Note                                                                                                                          |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/reference/route.json`           | modified | Six repo keys and urls, the `submodules` / `aggregate` references and three `release_flow` sentences use the lowercase names. |
| `route.json`                                                    | modified | Regenerated from the sole source with `node scripts/sync-route.mjs`.                                                          |
| `plugins/openindu-control-tower/skills/route/SKILL.md`          | modified | Panorama and per-repo notes use the new names; the casing note under "Known data issues" is rewritten.                        |
| `plugins/openindu-control-tower/skills/delivery-check/SKILL.md` | modified | Table rows, the submodule-status example and the sample report use the new names.                                             |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`     | modified | Version 5.4.0 -> 5.4.1.                                                                                                       |
| `.claude-plugin/marketplace.json`                               | modified | Version 5.4.0 -> 5.4.1.                                                                                                       |
| `revision/2026-10-18-lowercase-repo-names-in-route.md`          | added    | This record.                                                                                                                  |

## Trigger

User-requested rename of `openIndu-studio` to `openindu-studio` (the in-repo references are handled in openIndu/openindu-studio#67). The GitHub renames themselves were done outside this repo on 2026-10-17. While following up, re-running the CI coverage step locally showed that the old route keys no longer match `gh repo list`.

## Intentionally unchanged

- `mirror_gitee` of the studio entry: the Gitee mirror was not renamed.
- `local_path_hint` (`../openIndu-website`): names a local sibling directory, which was not renamed; no code reads it.
- The infra-deploy description ("The `openIndu-website/` subdir ..."): that is a directory inside the Gitee repo.
- `openIndu-vision`, `openIndu-cim`, `openIndu-controller`: still camelCase on GitHub. When they are renamed, their route keys must change in the same window.
- Prose in other skills (`build`, `design`), `team/STARTUP.md`, comments in `scripts/`, and `skills/principle/SKILL.md`. The latter is the sole source of the 11 RULEs; even a casing change there belongs to the principle modification process.
- Historical `revision/` and `spec/` records (RULE 6).

## Impact assessment

| Scope           | Note                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Affected agents | None behaviourally. `/route` and `/delivery-check` now answer with the lowercase names.                  |
| Downstream sync | Plugin consumers get 5.4.1 on their next `/plugin update`.                                               |
| CI              | Fixes the `route.json covers every org repo` step, which would otherwise fail against the renamed repos. |
| Rollback        | Revert this commit and run `node scripts/sync-route.mjs`.                                                |

## Verification record

- [x] `npx prettier --check "**/*.md"` passed
- [ ] arbiter review passed (not applicable: routing data and skill text only; no RULE text changed)
- [ ] downstream repos synced (not applicable until consumers run `/plugin update`)

Also run locally on the edited tree: `sync-route --check`, JSON parse of every tracked `*.json`, `check-roster`, the RULE 7 hook tests (28/28), and `claude plugin validate --strict` for the plugin and the marketplace. The coverage step was re-run with the new keys: 0 repos missing (it was 4 with the public-only view and 6 with an org-read token).
