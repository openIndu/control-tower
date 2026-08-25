---
date: 2026-08-04
slug: roster-finalized
type: agent
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 编制定稿 16 席；落地质量域 3 席；普查方法论更正

## 变更摘要

用户拍板三项决策，`spec/003` 由 `draft` 转 `finalized`；同时落地阶段 2 的三个质量席位，并新增模块级路由探测脚本。

## 三项拍板决策

| 问题                   | 决策             | 依据                                                                                      |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| 完整编制 vs 精简 12 席 | **完整**         | 精简方案要缓的 `rust` 风险密度最高、`security` 对应 RULE 5.4 整节，缓任何一个都留守则空缺 |
| `web` 拆不拆           | **拆**           | 实测 React 侧 151 文件 / Vue 侧 277 文件，量级相当，组件模型与状态管理范式完全不同        |
| `python` 是否够内聚    | **够，保持一席** | Web API / 采集器 / 工具链形态不同但栈一致（同样的依赖管理、测试框架、lint 配置）          |

> **算术说明**：「15 席」是在「完整 vs 精简」之间选完整；拆 `web` 使交付域 5→6，最终为 **16 席**。已在 spec 中写明。

## 落地：质量域 3 席（spec/003 阶段 2）

纯新增，不破坏任何现有引用。补的正是三条此前无人负责的守则：

| 席位       | 对应守则                       | 关键设计                                                                            |
| ---------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `test`     | RULE 2 的 agent 准入阻断性门槛 | 负责的是「可回归 / 反馈时延 / 可信度 / 覆盖真实性」四个指标，不是测试数量           |
| `reviewer` | RULE 5.2 四视角评审            | **明确无放行权**——RULE 5.2 禁止 agent 作为 L2+ 的唯一评审人；每条意见必须给失败场景 |
| `security` | RULE 5.4 整节                  | 此前只是 `inspector` 的第 12 个维度；报告泄漏时禁止复制凭证原文，结论是轮换而非删行 |

三席均补齐了「本席负责的能力指标」一节——回应 spec/003 问题 ⑦（此前每席只对「可写文件」负责，是权限模型不是职责模型）。

## 普查方法论更正（重要）

**此前的语言普查扫的是本机工作树，而本机多个 clone 在 feature 分支上：**

| 仓库                  | 本地分支                       | vs main     |
| --------------------- | ------------------------------ | ----------- |
| `openIndu-platform`   | `feat/frontend-react-refactor` | **ahead 8** |
| `openIndu-studio`     | `feat/local-rag-mcp`           | ahead 1     |
| `infra-deploy`        | `release/20260712-backend`     | ahead 1     |
| `openIndu-website`    | `main`                         | ✓           |
| `openIndu-controller` | `main`                         | ✓           |

用新脚本按 default branch 重测，两处数字要更正：

| 语言   | 原（feature 分支） | 更正（main） | 差异原因                                  |
| ------ | ------------------ | ------------ | ----------------------------------------- |
| Python | 279                | **285**      | platform 的 gateway 在 main 上仍是 Python |
| Rust   | 13                 | **0**        | 13 个 `.rs` 在**未合并**的 feature 分支上 |

`openindu-gateway` 正在从 Python 重写为 Rust，成果已推送 `feat/frontend-react-refactor` 但未合并 main。

**`rust` 席覆盖的是在途工作，不是存量。** 用户已知悉并保留该席——重写一旦合入就立刻需要归属，且协议层出错不会崩、只会静默产生错数据。

## 新增 `scripts/detect-modules.mjs`

按**构建清单文件**探测每个模块的语言（`pom.xml` / `Cargo.toml` / `*.csproj` / `pyproject.toml` / `package.json` / `go.mod` / `CMakeLists.txt`），走 GitHub tree API 不 clone——对 197 MB 的 `plc4x` 也是秒级。

这是 spec/003 阶段 3 的前置：语言席位需要知道自己该管哪些目录，而 `openIndu-platform` 一个 repo type 表达不了 6 个模块 4 种语言。

**脚本开发中修掉一个自身 bug**：优先级原本按文件生效而非按目录，导致同时含 `Cargo.toml` 与 `requirements.txt` 的目录会被 tree 顺序决定语言。改为取 `MANIFESTS` 中优先级最高者。

**这个脚本立刻发现了一处真实漂移**：`route.json` 把 `openindu-gateway` 标成 rust，而 main 上是 python——正是上面那个方法论问题。已更正，并在条目中记录 `pending_rewrite`。

## 涉及文件

| 文件                                                | 改动 | 说明                                                     |
| --------------------------------------------------- | ---- | -------------------------------------------------------- |
| `spec/003-agent-org-design.md`                      | 修改 | `draft` → `finalized`；16 席；`web` 拆分；普查数字更正   |
| `plugins/openindu-workflow/agents/test.md`          | 新增 | 质量域                                                   |
| `plugins/openindu-workflow/agents/reviewer.md`      | 新增 | 质量域                                                   |
| `plugins/openindu-workflow/agents/security.md`      | 新增 | 质量域                                                   |
| `plugins/openindu-workflow/reference/manifest.yaml` | 修改 | 注册 3 席 + 新增 `roster` 段（已落地 10 / 待落地 6）     |
| `plugins/openindu-workflow/reference/route.json`    | 修改 | `openindu-gateway` 语言更正为 python + `pending_rewrite` |
| `scripts/detect-modules.mjs`                        | 新增 | 模块级路由探测                                           |
| `.github/workflows/ci.yml`                          | 修改 | 新增 modules 漂移校验                                    |
| `plugin.json` / `marketplace.json`                  | 修改 | version **1.0.0 → 1.1.0**（新增 agent，minor）           |

## 影响评估

| 影响范围   | 说明                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 下游       | **本次 bump 到 1.1.0**——下游 `/plugin update` 可拿到 3 个质量席位与修正后的路由 |
| 已落地席位 | 7 → **10**（16 席中的 10 席）                                                   |
| 待落地     | 6 个语言席 + `release` / `product` / `data`（阶段 4，破坏性）                   |
| 回滚方法   | `git revert` 本 PR；下游可 `/plugin install` 指定 1.0.0                         |

## 验证记录

- [x] `npx prettier --check "**/*.md"` 通过
- [x] `node scripts/sync-route.mjs --check` 通过
- [x] `node scripts/detect-modules.mjs --check` 通过
- [x] `claude plugin validate ./plugins/openindu-workflow --strict` 通过
- [x] `claude plugin validate . --strict` 通过
- [x] 探测脚本在 `openindu-station`（8 csproj）与 `openIndu-platform`（6 模块）上实测正确
- [x] 编制决策依据（React 151 / Vue 277）来自实测，非估计
- [ ] 三个新席位的实际调用效果 —— 需重启会话后人工验证
