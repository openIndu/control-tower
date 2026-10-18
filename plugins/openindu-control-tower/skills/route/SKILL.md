---
name: route
description: Query openIndu repo routing — repo URL, type, host (GitHub/Gitee), image, domain, aggregate ownership, K8s namespace. Use to determine "which repo does this change belong to", "what's this service's image/domain", or "GitHub PR or Gitee PR".
argument-hint: "[repo name or type]"
---

# /route — openIndu repo routing

**Data source (sole)**: read with the Read tool:

```
${CLAUDE_SKILL_DIR}/../../reference/route.json
```

Read the file before answering — don't rely on memory; the repo list changes (product lines are expanding).

---

## Panorama

```
github.com/openIndu/
├── control-tower/   ← brain: principles, governance agents, plugin source
├── openindu-website/         ← aggregate: submodule聚合 + docker-compose + /build
├── openindu-backend/         ← backend: FastAPI (8004) + MCP Server (8005)
├── openindu-admin/           ← frontend: React admin → admin.openindu.com
├── openindu-portal/          ← frontend: React community site → openindu.com
├── openindu-studio/          ← tooling: low-code/workflow tooling (tool layer)
├── openindu-platform/        ← platform: IIoT base (platform layer)
├── openindu-station/         ← application: station apps (motion/dispense/laser) + submodule parent
│   ├── openindu-vision/      ← planned submodule @ src/OpenIndu.Station.Vision (camera HAL / calib / tools; extraction per spec/vision-001)
│   └── openindu-cim/         ← submodule @ src/OpenIndu.Station.Scan (scanner HAL, traceability)
└── openindu-controller/      ← edge: edge controller (edge layer)

gitee.com/openIndu/
└── infra-deploy/             ← gitops: K8s manifest sole home (ns=openindu-website)
```

## Required judgments in the answer

After reading the `route.json` entry, beyond the raw fields, answer these three follow-ups:

| Question           | Basis                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Which PR flow?** | `host: gitee` → Gitee PR, title/body **fully English** (RULE 9); others → GitHub PR     |
| **Rebuild image?** | If the entry has an `image` field → changes need `/build` and the full RULE 11 pipeline |
| **Can edit K8s?**  | Only `infra-deploy` can (RULE 8). Other repos keep only Dockerfile / nginx.conf         |

## Known data issues (flag in the answer)

- Repo-name casing: every org repo on GitHub is now all-lowercase (`openindu-*`: studio, website, portal, backend, platform and admin were renamed on 2026-10-17, vision, cim and controller on 2026-10-18; `openindu-station` always was). Older docs and history, the submodule directories inside `openindu-website` (e.g. `openIndu-backend/`), the directories in the Gitee `infra-deploy` repo and the Gitee mirror may still show camelCase: those are paths, not GitHub repo names. Write names and URLs exactly as in `route.json`; don't "correct" them. GitHub redirects old URLs, but the CI step `route.json covers every org repo` compares names case-sensitively against `gh repo list`, so after any GitHub rename update the `route.json` key in the same change window or CI goes red.
- **Release flow is not uniform across the non-backend repos — read each entry's `release_flow`, do not generalise:**
  - `openindu-platform` / `openindu-controller` — `release_flow: "independent"`; NOT in the `openindu-website` submodule aggregate, own build and deploy paths.
  - `openindu-studio` — independently maintained library, **not** a submodule of `openindu-website`; it produces no container image and has no manifest in `infra-deploy`, so delivery ends at its own reviewed repository change.
  - `openindu-station` — application layer, releases per its own flow. It is becoming a **submodule parent**: `openindu-vision` and `openindu-cim` are to mount at `src/OpenIndu.Station.Vision` and `src/OpenIndu.Station.Scan` — as of 2026-09-03 both sources are still in-tree (`openindu-station#173` unmerged; `openindu-vision` extraction is tracked in `openIndu-vision-product/spec/vision-001-form-and-contracts.md`).
  - `openindu-vision` / `openindu-cim` — submodules of `openindu-station` (planned; sources still in-tree): no image, no `infra-deploy` manifest, so RULE 11 ends at the parent's submodule-pointer PR. Their csproj reaches `OpenIndu.Station.Core` through a relative path that only resolves inside the parent checkout — **neither builds standalone today**; `openindu-vision`'s spec/vision-001 aims to sever that for vision. Changing them is a two-PR flow: the submodule repo first, then the pointer bump in `openindu-station`.
  - Use `/delivery-check` to determine which RULE 11 steps apply per repo.

## Editing routing

The **sole source** of `route.json` is `plugins/openindu-control-tower/reference/route.json` (in the control-tower repo). The root `route.json` is a sync product.

```bash
node scripts/sync-route.mjs          # sync from reference/ to root
node scripts/sync-route.mjs --check  # check consistency only (CI uses this)
```

Any routing change must come with a `revision/` record (`/revision-new`) and go via PR (RULE 7).
