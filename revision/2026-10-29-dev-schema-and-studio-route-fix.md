---
date: 2026-10-29
slug: dev-schema-and-studio-route-fix
type: route
related_spec: 005-org-dev-workflow
author: control-tower
pr: openIndu/control-tower#19
---

# route: add the /dev data contract (dev.schema.json) and fix openindu-studio's stale entry

## Summary

spec/005 stage 3 (data contract). Adds `reference/dev.schema.json`, the JSON Schema that documents and validates every `dev.*` field, the top-level `dev_grants` array, the issue terminal-state enum, and the runner exit-code table (spec/005 section 2.4) — the shared ground truth stages 4-9 build on. Also corrects `openindu-studio`'s route.json entry, which had drifted from the repo's actual current content, and bumps the plugin's minor version since distributed content changed.

No runner exists yet and `dev.enabled` is false everywhere (in fact absent everywhere, which the schema defines as the same thing) — this PR changes no agent's behavior.

## Files touched

| File                                                                                           | Change   | Note                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plugins/openindu-control-tower/reference/dev.schema.json`                                     | new      | JSON Schema 2020-12 for route.json's `dev_grants` + per-repo `dev` object; carries spec section 2.4's field table, issue terminal states, and runner exit codes as schema `description`s and enum `$defs`, so this one file is the sole source rather than a second markdown copy                |
| `plugins/openindu-control-tower/reference/route.json`                                          | modified | top-level `dev_grants: []`; `openindu-studio` entry: `modules` becomes a structured `{path, manifest, language}` array (plus bare `"scripts"`) matching `openindu-platform`'s existing polyglot convention, `polyglot_monorepo: true`, `release_flow` corrected, new `dev: {build: {note: ...}}` |
| `route.json`                                                                                   | modified | sync product, regenerated via `scripts/sync-route.mjs`                                                                                                                                                                                                                                           |
| `plugins/openindu-control-tower/skills/delivery-check/SKILL.md`                                | modified | studio row corrected to match                                                                                                                                                                                                                                                                    |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | modified | `5.5.0` → `5.6.0`                                                                                                                                                                                                                                                                                |

## Why studio's entry needed more than the three named fields

Verified directly against `openindu-studio`'s current `origin/main` (not from memory) before writing anything:

- `server/Dockerfile` and `web/Dockerfile` both exist and build (confirmed `FROM`/`EXPOSE` lines), plus a top-level `docker-compose.yml`. The old `release_flow` text ("produces no container image") was simply wrong.
- `node scripts/detect-modules.mjs --repo openindu-studio` detects `converters`/`local-rag-mcp`/`server`/`web` (python×3, javascript×1); the declared `modules` list was missing `server` and `web` entirely.
- `web/` is a full React+TypeScript app (`tsconfig.json`, `.tsx` sources, `vite.config.ts`), not Python — the old `primary_language: "python"` / "Python 99%" description text was stale. Removing `primary_language` without restructuring `modules` would have silently broken `/launch`'s `modules[].language` build-seat fallback (`launch/SKILL.md` section 2) for this repo, since plain string module entries have no `.language` to read — hence the switch to the structured per-module form already established by `openindu-platform`, not a plain rename.
- Studio has no registered Container Registry target and no infra-deploy manifest (true before and after this PR), so `dev.build` is an object carrying a `note` explaining why it isn't null (images exist) but also isn't populated (no push target yet) — not a guess at a registry path that has never existed (RULE 5.4).
- `dev.safety_paths` was deliberately **not** registered in this PR — spec/005 section 4's stage-3 bullet names only `modules`, `release_flow`, and `dev.build`; candidate paths (`converters/circuit/**`, `converters/plc/**`) are left for a later, separately-reviewed change before stage 9's grant.

## Verification

- `node scripts/sync-route.mjs --check` — pass
- `node scripts/detect-modules.mjs --check` — pass (studio no longer under-declares)
- `node scripts/detect-modules.mjs --repo openindu-studio` output (run locally with a `gh`-authenticated token that has access to this private repo, since CI cannot see private repos):
  ```
  openindu-studio
    converters                                   python       pyproject.toml
    local-rag-mcp                                python       requirements.txt
    server                                        python       pyproject.toml
    web                                          javascript   package.json
  ```
- `node scripts/check-roster.mjs`, `node scripts/check-version-bump.mjs`, `npx prettier@3 --check`, `claude plugin validate --strict` — pass
- `dev.schema.json` validates the final `route.json` (ad hoc local check with `ajv`/manual walk; not added as a standing CI step this PR — spec/005 stage 4 is where a deterministic-engine test suite gets wired into CI)

## Impact

| Scope                  | Note                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| Behavior change        | None. `dev.enabled` is unset (= false) everywhere; `dev_grants` is empty.     |
| Downstream sync needed | No — plugin version bump covers `/plugin update` distribution                 |
| Rollback               | Revert the PR; no data migration, no running code depends on these fields yet |

## Next

spec/005 stage 4 (deterministic engine, guards G1-G11) is the next PR, and is where `dev.schema.json` starts being read by actual code for the first time.
