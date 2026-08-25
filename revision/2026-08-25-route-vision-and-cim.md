---
date: 2026-08-25
slug: route-vision-and-cim
type: route
related_spec: —
author: control-tower
pr: openIndu/control-tower#NN
---

# 收录 openIndu-vision / openIndu-cim，并让组织覆盖检查说清自己的可见范围

## Summary

2026-08-25 把 `openindu-station` 的视觉与扫码模块拆成两个独立仓库（`openIndu/openindu-station#173`），本次在 `route.json` 补录这两个仓，并同步 `/route` 全景图、`/delivery-check` 适用范围表。

顺带修一处**检查失明**：`route.json covers every org repo` 这道 CI 检查只看得见公开仓，对全部 10 个私有仓无效——正是它没能拦下本次新增的两个私有仓。

## 变更

| 文件                                                  | 变更                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/reference/route.json` | 新增 `openIndu-vision` / `openIndu-cim` 两条；`openindu-station` 增加 `pending_split` 字段                                 |
| `route.json`                                          | 由 `node scripts/sync-route.mjs` 重新生成                                                                                  |
| `skills/route/SKILL.md`                               | 全景图把两个新仓画为 station 的子节点；Known data issues 的 release_flow 清单新增一条，写明两者不可独立构建、改动走两段 PR |
| `skills/delivery-check/SKILL.md`                      | 适用范围表新增一行：两个新仓止于 ③（父仓指针 PR）                                                                          |
| `.github/workflows/ci.yml`                            | 覆盖检查改为报告可见范围 + 私有仓为 0 时发 warning；token 优先取 `ORG_READ_TOKEN`                                          |
| `plugin.json` / `marketplace.json`                    | 5.2.3 → **5.2.4**                                                                                                          |

## 两条新路由的形状

与 `openIndu-studio` 在 `openIndu-website` 里的形状同构：是父仓的 submodule，不产出镜像，`infra-deploy` 中无 manifest，因此 **RULE 11 止于父仓的 submodule 指针 PR**。

额外记一条 studio 没有的约束：**两者都不能独立构建**。其 csproj 通过相对路径引用 `OpenIndu.Station.Core`，该路径只在父仓检出目录内成立。这是 submodule 方案的固有取舍（换 NuGet 会废掉厂商 SDK 的条件编译），已写进两个仓库各自的 README，此处在 `release_flow` 里同样标明，避免 agent 误判为"可独立交付"。

## 为什么没动 `openindu-station` 的 modules 列表

`#173` 尚未合并，`main` 上仍是 8 个 `.csproj`，`scripts/detect-modules.mjs` 现在也确实探测到 8 个。此刻若把 Vision/Scan 从 `modules` 删掉，`--check` 会立刻失败。

改用 `pending_split` 字段记录在途状态——沿用 `openIndu-platform` 里 `openindu-gateway` 的 `pending_rewrite` 写法。`#173` 合并后需要回来删掉那两条：GitHub tree API 不会深入 submodule，届时探测结果会变成 6 个。

## 顺带修的检查失明（2026-08-25 实测）

```
CI 里的 gh repo list openIndu  → 5 个（全部为公开仓）
本地有 org 权限的 token        → 15 个（公开 5 + 私有 10）
```

默认 `GITHUB_TOKEN` 只对本仓库有权限，列组织仓库时只返回公开仓。这道检查的注释写着"靠人维护清单必然漂移，改由 CI 校验"，但它实际覆盖的是全组织的三分之一，且**不含任何业务仓**。绿灯长期被误读为"全组织已覆盖"。

真正的修法需要一个有 org 读权限的 PAT（secret `ORG_READ_TOKEN`），本次未配置——只让检查说清自己看见了什么：打印可见仓数与其中私有仓数，私有仓为 0 时发 `::warning::`。token 已改为优先取 `ORG_READ_TOKEN`，配上即自动全覆盖，无需再改 workflow。

## Verification

- [x] `node scripts/sync-route.mjs --check` — 源与根一致
- [x] `node scripts/detect-modules.mjs --check` — 声明 modules 与实际探测一致
- [x] `node scripts/check-roster.mjs` — 20 席不变
- [x] `node plugins/openindu-control-tower/hooks/block-push-main.test.mjs` — 28 例全过
- [x] `npx prettier --check "**/*.md"`
- [x] JSON 全部可解析

## Impact

| Scope      | Note                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Downstream | patch 5.2.3→5.2.4；`/route` 与 `/delivery-check` 开始认识两个新仓                                                   |
| 行为       | 纯数据与文档补录，无逻辑变更；CI 覆盖检查的判定标准未变，只是多打印了可见范围并在盲区时告警                         |
| Rollback   | `git revert`；下游可 `/plugin install @5.2.3`                                                                       |
| 待办       | ① `#173` 合并后删掉 station 的两条 modules 并移除 `pending_split`；② 配置 `ORG_READ_TOKEN` 让覆盖检查真正覆盖全组织 |
