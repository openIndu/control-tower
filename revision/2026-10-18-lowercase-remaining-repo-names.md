---
date: 2026-10-18
slug: lowercase-remaining-repo-names
type: route
related_spec: —
author: control-tower
pr: openIndu/control-tower#TBD
---

# Route: vision, cim and controller follow the lowercase rename; remaining repo-name prose

## Summary

On 2026-10-18 the last three camelCase repos in the org were renamed on GitHub to all-lowercase names: `openIndu-vision`, `openIndu-cim` and `openIndu-controller` became `openindu-vision`, `openindu-cim` and `openindu-controller` (the other six followed on 2026-10-17, see `2026-10-18-lowercase-repo-names-in-route.md`). Every org repo on GitHub is now lowercase, so this change renames the remaining three route keys and urls, updates the `local_path_hint` of the website checkout (its local directory was renamed to `openindu-website`), and brings the prose that names repos (not paths) in the `route`, `delivery-check`, `build` and `design` skills, `team/STARTUP.md` and two script comments in line. The casing note under "Known data issues" in the route skill is rewritten: camelCase is no longer the org convention.

## Files involved

| File                                                            | Change   | Note                                                                                                                                       |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `plugins/openindu-control-tower/reference/route.json`           | modified | vision / cim / controller keys and urls, their mentions in the station `pending_split` note and the cim `release_flow`, `local_path_hint`. |
| `route.json`                                                    | modified | Regenerated from the sole source with `node scripts/sync-route.mjs`.                                                                       |
| `plugins/openindu-control-tower/skills/route/SKILL.md`          | modified | Panorama and per-repo notes use the new names; the casing note under "Known data issues" is rewritten.                                     |
| `plugins/openindu-control-tower/skills/delivery-check/SKILL.md` | modified | The vision / cim row.                                                                                                                      |
| `plugins/openindu-control-tower/skills/build/SKILL.md`          | modified | The aggregate repo name, and the "Repo" column of the image table (repo names only).                                                       |
| `plugins/openindu-control-tower/skills/design/SKILL.md`         | modified | Repo names in the submodule / aggregate guidance.                                                                                          |
| `team/STARTUP.md`                                               | modified | Repo names in the examples and the sample report.                                                                                          |
| `scripts/check-roster.mjs`                                      | modified | One repo name in a comment; no logic change.                                                                                               |
| `scripts/detect-modules.mjs`                                    | modified | One repo name in a comment; no logic change.                                                                                               |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`     | modified | Version 5.4.1 -> 5.4.2.                                                                                                                    |
| `.claude-plugin/marketplace.json`                               | modified | Version 5.4.1 -> 5.4.2.                                                                                                                    |
| `revision/2026-10-18-lowercase-remaining-repo-names.md`         | added    | This record.                                                                                                                               |

## Trigger

User request on 2026-10-18 to change everything that was not yet changed, after the six-repo rename (openIndu/control-tower#11). The three remaining repos were renamed on GitHub in the same session; their route keys have to follow in the same window because the CI step `route.json covers every org repo` compares names case-sensitively against `gh repo list`.

## Intentionally unchanged

- Paths, not repo names: the submodule directories inside `openindu-website` (`openIndu-backend/`, `openIndu-admin/`, `openIndu-portal/`, as in `.gitmodules` and in the Dockerfile-location column of the build skill) and `infra-deploy/openIndu-website/...` (a directory inside the Gitee repo).
- `openIndu-vision-product`: a different docs folder, not the vision repo.
- `mirror_gitee` of the studio entry (the Gitee mirror was not renamed) and the infra-deploy description's `openIndu-website/` subdir.
- `skills/principle/SKILL.md` (sole source of the 11 RULEs; any change goes through the principle modification process), the historical comment in `.github/workflows/ci.yml`, and the historical `revision/` and `spec/` records (RULE 6).

## Impact assessment

| Scope           | Note                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Affected agents | None behaviourally. `/route`, `/delivery-check`, `/build` and `/design` now quote the lowercase names.                   |
| Downstream sync | Plugin consumers get 5.4.2 on their next `/plugin update`.                                                               |
| CI              | Keeps `route.json covers every org repo` green: the route keys now equal `gh repo list` (15 of 15, plus `infra-deploy`). |
| Rollback        | Revert this commit and run `node scripts/sync-route.mjs`.                                                                |

## Verification record

- [x] `npx prettier --check "**/*.md"` passed
- [ ] arbiter review passed (not applicable: routing data and skill text only; no RULE text changed)
- [ ] downstream repos synced (not applicable until consumers run `/plugin update`)

Also run locally on the edited tree: `sync-route --check`, JSON parse of every tracked `*.json`, `check-roster`, the RULE 7 hook tests (28/28), and `claude plugin validate --strict` for the plugin and the marketplace. The coverage step was re-run against `gh repo list` with the new keys: 0 repos missing in both the public-only and the org-read view.
