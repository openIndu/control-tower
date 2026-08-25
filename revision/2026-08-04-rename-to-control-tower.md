---
date: 2026-08-04
slug: rename-to-control-tower
type: manifest
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/control-tower#TBD
---

# Rename: workflow-control-tower → control-tower; plugin openindu-workflow → openindu-control-tower

## Summary

Repo and plugin renamed to reflect the v5 autonomous SDLC platform identity (the "workflow" prefix was narrow for an autonomous idea→deploy→monitor agent platform). Repo drops the redundant `openindu-` prefix (governance/infra repos in the org don't carry it); the plugin keeps the `openindu-` prefix (global plugin identifier, avoids collision).

## Decisions

| Asset       | Old                               | New                               | Rationale                                                                                                                                                                |
| ----------- | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repo        | `openIndu/workflow-control-tower` | `openIndu/control-tower`          | governance/infra repos don't carry `openindu-` prefix (cf. infra-deploy, .github, community); `control-tower` accurate for the brain; no `openIndu/openindu-...` stutter |
| Plugin      | `openindu-workflow@openindu`      | `openindu-control-tower@openindu` | plugin id is global, keeps namespace prefix to avoid collision                                                                                                           |
| Marketplace | `openindu`                        | `openindu` (unchanged)            | —                                                                                                                                                                        |
| Plugin dir  | `plugins/openindu-workflow/`      | `plugins/openindu-control-tower/` | consistency with plugin name                                                                                                                                             |

## Changes (51 files, exclude revision/ + spec/ historical)

- `gh repo rename control-tower` (GitHub auto-redirects old URL)
- `git mv plugins/openindu-workflow plugins/openindu-control-tower`
- Global replace in non-historical files: `workflow-control-tower`→`control-tower`, `openindu-workflow`→`openindu-control-tower`
- `route.json`: repo key `workflow-control-tower`→`control-tower` + url
- `manifest.yaml`: control-tower agent `repos: [control-tower]`
- `plugin.json`/`marketplace.json`: `name` + `homepage`/`repository` + `source` path
- `check-roster.mjs`: `pluginDir` path + stale-name guard now bans the OLD plugin-ref prefix `openindu-workflow:` (renamed) and v2 delivery seats under either prefix
- CI (ci.yml): validate path + error messages
- CLAUDE/README/README_ZH/adopt/route/principle/launch/revision-new/spec-new/delivery-check skills + team README/STARTUP/principle + control-tower/manager agents: prose + paths + `/plugin install` examples

## Untouched

- `revision/` + `spec/` historical records (RULE 6 — keep old-name narrative)
- Marketplace name `openindu` (unchanged)

## Downstream (later, on onboarding)

Each repo's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "openindu": {
      "source": { "source": "github", "repo": "openIndu/control-tower" }
    }
  },
  "enabledPlugins": { "openindu-control-tower@openindu": true }
}
```

Install: `/plugin install openindu-control-tower@openindu`. GitHub redirects the old URL, so existing references keep working until refreshed.

## Verification

- [x] `gh repo rename` succeeded; origin updated; `gh repo view openIndu/control-tower` confirms
- [x] prettier --check (3.9.6)
- [x] sync-route --check / detect-modules --check
- [x] check-roster (20 seats + stale-name guard bans old `openindu-workflow:` prefix + business-leak guard)
- [x] `claude plugin validate --strict` (plugin + marketplace)
- [x] route.json covers every org repo (control-tower matches `gh repo list`)
