---
date: 2026-08-04
slug: complete-repo-census
type: route
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 补全组织仓库普查：route.json 漏收 4 个仓，含组织内最大代码体

## 变更摘要

用户要求 clone `openindu-vision` 与 `openIndu-studio` 补完语言普查。执行后发现**问题不在这两个仓**——而在 `route.json` 本身：用 `gh repo list openIndu` 对账，组织有 **14 个 GitHub 仓**，`route.json` 只收录 **9 个**。

管控中心维护的路由表，连组织有哪些仓都不准。

## 漏收的仓

| 仓库               | 性质                                     | 规模         | 语言构成                                          |
| ------------------ | ---------------------------------------- | ------------ | ------------------------------------------------- |
| `plc4x`            | fork of `apache/plc4x`                   | **197 MB**   | Java 73% / **Go 8.4%** / Ruby 7.4% / C# 4% / C 3% |
| `openindu-station` | **自研** C#，8 个 `.csproj`              | 180 个 `.cs` | C# 99.7%                                          |
| `openplc-runtime`  | fork of `Autonomy-Logic/openplc-runtime` | 2.2 MB       | Python 37% / C 35% / C++ 25%                      |
| `community`        | 社区治理文档                             | 5 KB         | —                                                 |
| `.github`          | 组织级 GitHub 配置                       | 34 KB        | —                                                 |

`plc4x` 是**组织内最大的代码体**，比全部自研代码加起来还大一个量级，此前从不存在于任何编制讨论中。

## 已收录条目的错误

**`openindu-vision` 是空仓。** `route.json` 把它描述成「工业视觉应用（缺陷检测等），用 studio 构建的第一个样板/变现应用」。实际：2026-07-01 创建后**从未推送**，`size=0`，无默认分支。

真实的视觉能力在 **`openindu-station/src/OpenIndu.Station.Vision/`**——那个仓根本没被收录。

## 对编制的影响

| 结论                 | 变化                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `dotnet` 席位规模    | **110 → 290 源文件**，从第 5 大栈升到第 3。两个自研 C# 仓、11 个项目                     |
| Go 席位问题          | Go 确实存在（`plc4x` 8.4%），但**只在 fork 里**。不设 `go` 席，改设 `fork` 席            |
| 新增 `fork` 席       | fork 的工作是跟踪上游、管理补丁集，不是写业务代码。按语言拆 `go`/`ruby`/`c`/`cpp` 是误用 |
| vision 第 6 席的疑虑 | **排除**——空仓，不引入新语言                                                             |
| 编制总数             | 15 → **16 席**                                                                           |

## 涉及文件

| 文件                                             | 改动 | 说明                                                                                                                                                                                   |
| ------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-workflow/reference/route.json` | 修改 | 补录 5 个仓；`openindu-vision` 改标 `status: empty`；`openIndu-platform` 增 `modules` 声明 6 个子模块及语言；`openIndu-studio` 增 Gitee 镜像与 `modules`；两个 fork 增 `upstream` 字段 |
| `route.json`                                     | 修改 | 同步产物                                                                                                                                                                               |
| `.github/workflows/ci.yml`                       | 修改 | **新增 `route.json covers every org repo` 步骤**：用 `gh repo list` 对账，漏收即 fail                                                                                                  |
| `spec/003-agent-org-design.md`                   | 修改 | 新增问题 ⑨；交付域规模修正；新增 `fork` 域；编制 15→16 席；待解决问题更新                                                                                                              |

## 触发原因

用户指令：「先 clone vision 和 studio 补完普查」。

`openindu-vision` 无需 clone（API 已确认为空仓）；`openIndu-studio` 本机已 clone 但指向 Gitee 且在 `feat/local-rag-mcp` 分支，改用 GitHub API 读取权威分支的文件树完成普查。

## 影响评估

| 影响范围       | 说明                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| 路由完整性     | route.json 从 9 个 GitHub 仓补到 14 个，与 `gh repo list` 完全一致，并由 CI 持续校验       |
| 编制设计       | `dotnet` 席位举证强度大幅提升；新增 `fork` 席；vision 的不确定性排除                       |
| 是否需下游同步 | 插件内 `reference/route.json` 已变，**需要 bump 版本**下游才能拿到——留待编制定稿后一并发版 |
| 回滚方法       | `git revert` 本 PR                                                                         |

## 遗留问题

- `openIndu-studio` 在 GitHub 与 Gitee 两处都有，**权威源待确认**——影响 `/adopt` 该往哪个仓提 PR
- 两个 fork 与上游的偏离程度未测；`fork` 席落地前需量化本地补丁量与 rebase 可行性
- 本次未 bump 插件版本（编制未定稿，避免连发两个版本）

## 验证记录

- [x] `node -e "JSON.parse(...)"` route.json 语法合法
- [x] `node scripts/sync-route.mjs --check` 通过
- [x] `comm -23 <(gh repo list) <(route.json keys)` 输出为空——收录完整
- [x] `npx prettier --check "**/*.md"` 通过
- [x] `claude plugin validate ./plugins/openindu-workflow --strict` 通过
- [ ] arbiter 审核 —— **待办**，spec/003 仍为 `draft`
