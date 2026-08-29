---
name: delivery-check
description: 'Generate and check the RULE 11 delivery-pipeline completeness checklist (sub-repo PR → merge → aggregate submodule → image build → infra-deploy PR → kubectl apply). Must run before reporting any openIndu bug fix / feature complete, to prevent "applied but not live".'
argument-hint: "[repo name or PR link]"
---

# /delivery-check — RULE 11 delivery-pipeline self-check

openIndu is a submodule-aggregate architecture. Sub-repo merge ≠ live. Miss any box and the change won't reach production.

**Call `/principle` first** (RULE 1); use `/route` for image and ownership if needed.

---

## The pipeline

```
① sub-repo PR          ② sub-repo merge       ③ aggregate submodule pointer + PR
        │                      │                          │
        └──────────────────────┴──────────────────────────┘
                               ▼
④ /build image build+push   ⑤ infra-deploy PR (Gitee, English)   ⑥ kubectl apply (human)
```

## Determine which boxes apply

Use `/route` to find which repo the change is in, then:

| Change location                                          | Applies         | Note                                                                                       |
| -------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `openIndu-backend` / `-admin` / `-portal`                | ① to ⑥ **all**  | submodule sub-repos; image rebuild needed                                                  |
| `openIndu-website` (aggregate itself)                    | ① ② ④ ⑤ ⑥       | no ③; it IS the aggregate                                                                  |
| `infra-deploy` (K8s manifests only)                      | ⑤ ⑥             | no ④ unless image changes                                                                  |
| `control-tower`                                          | ① ②             | control layer, not in cluster; downstream `/plugin update`                                 |
| `openIndu-studio`                                        | ① ②             | independent library; not in the Website aggregate and has no image                         |
| `openIndu-platform` / `-controller` / `openindu-station` | ① ② + as needed | not in website aggregate; per their own release flow                                       |
| `openIndu-vision` / `openIndu-cim`                       | ① ② ③           | submodules of `openindu-station`, no image → ends at ③ (the pointer bump PR in the parent) |

Mark non-applicable boxes **N/A**, not ✅ — the two mean different things.

## Per-box check

For each box, get **verifiable evidence** before checking — no gut-feel:

| #   | Box                 | Evidence                                                   | How to get it                              |
| --- | ------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| ①   | sub-repo PR         | PR number + URL                                            | `gh pr list --repo openIndu/<repo>`        |
| ②   | sub-repo merge      | merge commit SHA                                           | `gh pr view <n> --json state,mergedAt`     |
| ③   | aggregate submodule | `openIndu-website` submodule points at ②'s SHA + PR number | `git -C openIndu-website submodule status` |
| ④   | image               | image tag (`${OPENINDU_REGISTRY}/openindu/<name>:<tag>`)   | `/build` output or registry                |
| ⑤   | infra-deploy PR     | Gitee PR number + URL (English title/body, RULE 9)         | Gitee repo                                 |
| ⑥   | kubectl apply       | user confirms executed + deployment rolled                 | **human-only**; agent holds no kubeconfig  |

## Output format

```
Delivery pipeline — <change summary>

① sub-repo PR:              openIndu/openIndu-backend#123        ✅
② sub-repo merge:           a1b2c3d                              ✅
③ aggregate submodule PR:   openIndu/openIndu-website#78         ✅
④ image:                    ${OPENINDU_REGISTRY}/openindu-backend:20260803-1   ⏳ /build pending
⑤ infra-deploy PR:          —                                    ⏳ pending creation
⑥ kubectl apply:            —                                    ⏳ pending user execution

Conclusion: incomplete. Remaining ④⑤⑥.
Next step: run /build in openIndu-website to build the backend image.
```

## Hard requirements

- **As long as any ⏳ remains, do not say "done"** — say "①②③ done, remaining ④⑤⑥, next step X".
- ⑥ must be executed by a human. Provide a copy-paste one-liner, e.g.
  `kubectl -n openindu-website rollout restart deployment/web-api`
- ⑤'s Gitee PR title/body in English (RULE 9)
- K8s manifests only in the `infra-deploy` repo (RULE 8); don't create `k8s/` in business sub-repos
- Don't mix build and deploy in the same commit
