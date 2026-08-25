---
date: 2026-08-04
slug: fork-divergence-and-studio-host
type: route
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 量化 fork 偏离后撤销 `fork` 席；确认 studio 权威源为 GitHub

## 变更摘要

两件事：

1. **用户确认 `openIndu-studio` 的权威源是 GitHub**，Gitee 仅作镜像。
2. **实测两个 fork 与上游的偏离，结果推翻了 `spec/003` 上一版提出的 `fork` 席**——撤销，编制 16 → 15 席。

## fork 偏离实测（2026-08-04，GitHub compare API）

| 仓库              | 上游                             | 状态       | ahead | behind | 改动文件 |
| ----------------- | -------------------------------- | ---------- | ----- | ------ | -------- |
| `plc4x`           | `apache/plc4x`                   | `diverged` | **6** | 18     | 49       |
| `openplc-runtime` | `Autonomy-Logic/openplc-runtime` | `behind`   | **0** | 41     | **0**    |

### `openplc-runtime`：零本地改动

纯镜像，只是落后 41 个提交。**没有任何维护工作量**，不需要席位——只需要一条同步策略。

### `plc4x`：补丁集 100% 在 .NET

49 个改动文件的构成：

| 扩展名    | 数量 |
| --------- | ---- |
| `.cs`     | 40   |
| `.csproj` | 6    |
| `.yml`    | 1    |
| `.sln`    | 1    |
| `.props`  | 1    |

**上游的 Java / Go / Ruby / C 代码，一行都没碰过**（grep 计数为 0）。

6 个本地提交（2026-07-24，全部由 TomNewChao 提交）：

- `feat(plc4net)`: 实现 SPI3 驱动运行时
- `refactor(plc4net)`: API 对齐 SPI3（Field→Tag，同步驱动）
- `ci(plc4net)`: 新增 .NET 平台兼容性 workflow
- `fix(plc4net)`: 替换 bit codec，修复 ReadBuffer/WriteBuffer
- `fix(plc4net)`: 让 IPlcValue 派发能到达具体值类型
- `build(plc4net)`: net452 → net8.0

另含 **929 行新增测试**（`spi-test/` 下 5 个测试文件）。

## 结论：这不是 fork 维护，是 C# 开发

`plc4x` 的工作实质是**在 Apache PLC4X 的 .NET 子项目上做开发并向上游贡献**，归 `dotnet` 席，不需要独立席位。

这也彻底回答了 Go 的问题：`plc4x` 里 8.4% 的 Go 是**上游代码**，openIndu 从未修改，**不构成任何编制需求**。

取而代之的是一条**策略**（不占编制）：

| 场景                                 | 策略                                                           |
| ------------------------------------ | -------------------------------------------------------------- |
| fork 有本地补丁（`plc4x`）           | 由对应语言席位负责；`inspector` 定期报 `behind_by`，超阈值告警 |
| fork 无本地补丁（`openplc-runtime`） | 定期 fast-forward，或确认不再需要后归档                        |
| 新增 fork                            | 必须在 `route.json` 标 `upstream` 与 `delivery_owner`          |

## 对编制的影响

| 项目            | 变化                                                    |
| --------------- | ------------------------------------------------------- |
| `fork` 席       | **撤销**                                                |
| `dotnet` 席规模 | 290 → **330** 源文件（增加 `plc4x/plc4net` 的上游贡献） |
| 编制总数        | 16 → **15 席**（精简方案 12 席）                        |

## 涉及文件

| 文件                                             | 改动 | 说明                                                                                                     |
| ------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-workflow/reference/route.json` | 修改 | `openIndu-studio` 增 `authoritative_host: github`；两个 fork 增 `divergence` 实测数据与 `delivery_owner` |
| `route.json`                                     | 修改 | 同步产物                                                                                                 |
| `spec/003-agent-org-design.md`                   | 修改 | 「上游 fork 域（1 席）」改为「上游 fork：需要的是策略，不是席位」；编制 16→15；两个待解决问题标记已查明  |

## 触发原因

用户答复：「3，github 是权威源」——选择处理遗留的两个事实问题，并确认 studio 权威源。

## 影响评估

| 影响范围       | 说明                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| 编制设计       | 少一席；`dotnet` 举证进一步加强                                          |
| `/adopt` 行为  | studio 接入时应指向 GitHub 仓提 PR，不是 Gitee                           |
| 是否需下游同步 | 插件内 `route.json` 已变，仍未 bump 版本（编制未定稿，避免连发多个版本） |
| 回滚方法       | `git revert` 本 PR                                                       |

## 本次纠正的自身错误

`fork` 席是在**没有测量偏离数据**的情况下提出的。一测就发现两个 fork 一个零改动、一个改动全在 C#——**编制不该建立在猜测上**。

这是 `spec/003` 第三次自我纠正（前两次：栈无关参数化、交付域按前后端切）。三次的共同模式都是**先有设计直觉、后补事实**，正确顺序应当反过来。

## 验证记录

- [x] `route.json` 语法合法 + `sync-route.mjs --check` 通过
- [x] `npx prettier --check "**/*.md"` 通过
- [x] fork 偏离数据来自 GitHub compare API，非推断
- [x] 「补丁集未触碰 Go/Ruby/Java」经 grep 计数验证为 0
- [ ] arbiter 审核 —— **待办**，`spec/003` 仍为 `draft`
