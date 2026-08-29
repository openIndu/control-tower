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
├── openIndu-website/         ← aggregate: submodule聚合 + docker-compose + /build
├── openIndu-backend/         ← backend: FastAPI (8004) + MCP Server (8005)
├── openIndu-admin/           ← frontend: React admin → admin.openindu.com
├── openIndu-portal/          ← frontend: React community site → openindu.com
├── openIndu-studio/          ← tooling: low-code/workflow tooling (tool layer)
├── openIndu-platform/        ← platform: IIoT base (platform layer)
├── openindu-station/         ← application: station apps (motion/dispense/laser) + submodule parent
│   ├── openIndu-vision/      ← submodule @ src/OpenIndu.Station.Vision (camera HAL / calib / tools)
│   └── openIndu-cim/         ← submodule @ src/OpenIndu.Station.Scan (scanner HAL, traceability)
└── openIndu-controller/      ← edge: edge controller (edge layer)

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

- The repo name `openindu-station` is all-lowercase, inconsistent with the other `openIndu-*` camelCase. Write URLs exactly as in `route.json`; don't "correct" them. A GitHub repo rename is needed to resolve this.
- **Release flow is not uniform across the non-backend repos — read each entry's `release_flow`, do not generalise:**
  - `openIndu-platform` / `openIndu-controller` — `release_flow: "independent"`; NOT in the `openIndu-website` submodule aggregate, own build and deploy paths.
  - `openIndu-studio` — independently maintained library, **not** a submodule of `openIndu-website`; it produces no container image and has no manifest in `infra-deploy`, so delivery ends at its own reviewed repository change.
  - `openindu-station` — application layer, releases per its own flow. Since 2026-08-25 it is also a **submodule parent**: `openIndu-vision` and `openIndu-cim` mount at `src/OpenIndu.Station.Vision` and `src/OpenIndu.Station.Scan`.
  - `openIndu-vision` / `openIndu-cim` — submodules of `openindu-station`: no image, no `infra-deploy` manifest, so RULE 11 ends at the parent's submodule-pointer PR. **Neither builds standalone** — their csproj reaches `OpenIndu.Station.Core` through a relative path that only resolves inside the parent checkout. Changing them is a two-PR flow: the submodule repo first, then the pointer bump in `openindu-station`.
  - Use `/delivery-check` to determine which RULE 11 steps apply per repo.

## Editing routing

The **sole source** of `route.json` is `plugins/openindu-control-tower/reference/route.json` (in the control-tower repo). The root `route.json` is a sync product.

```bash
node scripts/sync-route.mjs          # sync from reference/ to root
node scripts/sync-route.mjs --check  # check consistency only (CI uses this)
```

Any routing change must come with a `revision/` record (`/revision-new`) and go via PR (RULE 7).
