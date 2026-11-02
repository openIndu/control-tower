---
date: 2026-11-02
slug: pr-scope-ci-guard
type: other
related_spec: —
author: control-tower
pr: openIndu/control-tower#TBD
---

# 把 RULE 4 规模上限 / 测试完整性 / 受保护路径可见性拆成独立 CI 检查

## 变更摘要

`engine/guards-core.mjs` 的 G4/G5 目前只在已授权的 `/dev` 自动合并运行里生效——这条仓库对"任何人下载都能复用、PR 偏移可控"这个定位（见 memory `control-tower-purpose-community-reuse`）来说是个缺口：今天一个未经 `/dev` 授权的仓，哪怕是超大、跨多模块、删测试的 PR，也没有任何自动机制拦截。本次新增 `scripts/check-pr-scope.mjs`，复用 `path-rules.mjs`/`test-integrity.mjs`/`merge-facts.mjs` 里已有测试覆盖的纯函数，对**本仓每一个 PR**（不要求 `/dev` 授权）做同类检查，接入 `ci.yml`。不是把 G4/G5 从 `engine/` 搬走——两者继续原样服务 `/dev` 自己更严格的无人值守场景，一行未改。

本次检查与 G4/G5 原文有两处刻意不同（脚本头部注释有完整论证）：

1. 规模上限用 RULE 4 自己的「OR」（≤400 行 **或** ≤1 模块边界），不是 G5 的「AND」——`guards-core.mjs` 自己的注释说明 AND 是专门为无人值守合并收紧的，人工评审的 PR 适用的是 RULE 4 本身，不是 `/dev` 的加码。
2. 受保护路径命中只告警（`::warning::`），不拦截——本仓日常维护本身就会持续改 `CLAUDE.md`/`.github/workflows/**`，硬拦截会和本仓自己的正常工作流打架；G4 对这些路径的硬拦截是专为`/dev`无人审查场景设计的。

## 涉及文件

| 文件                              | 改动类型 | 说明                                                          |
| --------------------------------- | -------- | ------------------------------------------------------------- |
| `scripts/check-pr-scope.mjs`      | 新增     | 规模/测试完整性/受保护路径检查，纯函数 + CLI 入口             |
| `scripts/check-pr-scope.test.mjs` | 新增     | 12 条用例（含 OR-vs-AND 的"撤销→变红"验证，已在本地手动做过） |
| `.github/workflows/ci.yml`        | 修改     | 新增一步跑该脚本；测试文件加进既有的 engine 测试步骤列表      |

## 触发原因

用户在本次对话中先纠正了我对 control-tower 核心定位的理解（它首先是面向社区贡献的可复用治理工具，不是以 `/dev` 自动合并为核心叙事），随后我指出 G4/G5 式硬护栏目前只绑定在未激活的 `/dev` 里、没拆成对所有 PR 生效的仓库级 CI；用户据此直接要求"把 G4/G5 从 /dev 里拆出来，做成独立的 CI 检查"。

## 影响评估

| 影响范围               | 说明                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 哪些 repo agent 受影响 | 无——不改变任何 agent 定义、行为或插件分发内容（`scripts/`/`.github/` 都在插件目录之外，`check-version-bump.mjs` 已核实无需升版） |
| 是否需要下游同步       | 否——这是 control-tower 自己仓库的 CI 门禁，不是插件分发内容，不会随 `/plugin update` 流到下游仓                                  |
| 回滚方法               | `git revert` 本 PR；新增文件直接删除，`ci.yml` 的两处编辑随 revert 还原                                                          |

## 验证记录

- [x] 修改后 `prettier --check` 通过
- [x] `node scripts/check-pr-scope.test.mjs` 12/12 通过，含人工撤销 OR→AND 验证确认用例真会变红
- [x] 现有 `scripts/check-version-bump.mjs`、`scripts/sync-route.mjs --check`、`scripts/check-roster.mjs` 均不受影响，继续通过
- [ ] CI 绿——待 PR 开出后核实
