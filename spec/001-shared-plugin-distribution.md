---
spec_id: 001-shared-plugin-distribution
title: 用 Claude Code 插件把守则与治理 agent 下发到全组织
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-08-03
updated: 2026-08-03
supersedes:
related_repos:
  - workflow-control-tower
  - openIndu-website
  - openIndu-platform
  - openIndu-studio
  - openIndu-controller
  - openIndu-backend
  - openIndu-admin
  - openIndu-portal
  - openindu-vision
  - infra-deploy
implementing_agents:
  - control-tower
  - backend
  - frontend
  - infra-deploy
related_rules:
  - RULE 1
  - RULE 2
  - RULE 5
  - RULE 6
  - RULE 7
---

# 用 Claude Code 插件把守则与治理 agent 下发到全组织

## 1. 背景（WHY）

管控中心的核心承诺是"把 CLAUDE.md / agent 定义 / workflow 等基础资产**下发**到各子仓"。这个承诺此前**没有任何实现**——没有脚本、没有 CI、没有 submodule、没有插件，只有文字描述。结果是各仓各自演化。

### 实测到的分叉（2026-08-03 扫描）

| 仓库                     | 守则副本                          | 行数 / RULE 标题数 | agent 体系                             |
| ------------------------ | --------------------------------- | ------------------ | -------------------------------------- |
| `workflow-control-tower` | `team/principle.md`               | 219 行 / **11 条** | `team/agents/*.md`（7，纯文档格式）    |
| `openIndu-website`       | `.claude/governance/principle.md` | 54 行 / **0 条**   | `.claude/agents/*.md`（4）             |
| `openIndu-platform`      | `.claude/PRINCIPLE.md`            | 104 行 / **6 条**  | `.claude/agents/<name>/AGENT.md`（13） |
| `infra-deploy`           | 无                                | —                  | `.claude/agents/ops.md`（1）           |

三份守则内容互不相同（MD5 各异）。25 个 agent 定义、4 套目录约定、0 个共享。

### 根因

1. **`team/agents/*.md` 不是 subagent 格式**——7 个文件全部缺 YAML frontmatter（`name` / `description`），Claude Code 永远不会把它们注册为 agent。它们是文档，不是可执行资产。
2. **Rule #1 的引用路径跨仓不可解析**——每个 agent 文件写 `[principle.md](../principle.md)`。在 `openIndu-backend` 里没有 `../principle.md`。"启动第一步加载守则"在任何子仓都是空指令。
3. **`/launch`、`/build` 是幽灵命令**——文档大量引用，全仓无对应文件。`launch.sh` 只是打印一段提示词给人复制，且依赖 `python3`。
4. **没有分发载体**——"下发"无从执行，只能人肉拷贝正文，而拷贝就是分叉的成因。

此外 `openIndu-platform` 已尝试自建插件（`.claude/plugins/openindu-agents/plugin.json`），但格式不符合规范（清单不在 `.claude-plugin/` 下、`agents` 应为路径字符串数组却写成 `{name, path}` 对象数组、`hooks` 应为 `{"hooks": {"<Event>": [...]}}` 却写成数组），几乎肯定从未生效。说明需求真实存在，缺的是统一的、规范的载体。

## 2. 设计要点（WHAT）

- **用 Claude Code Plugin + Marketplace 作为唯一分发载体**。这是能让所有仓零拷贝共享 agent / skill / hook，并通过 `/plugin update` 统一升级的原生机制。
- **守则唯一源迁到 `plugins/openindu-workflow/skills/principle/SKILL.md`**，通过 `/principle` 调用。skill 调用与仓库路径无关，跨仓可解析——这是对根因 2 的直接修复。
- **7 个 agent 转成真正的 subagent 格式**（补 YAML frontmatter），以 `openindu-workflow:` 前缀命名，不与各仓本地 agent 撞名。
- **RULE 7 从"文字约定"升级为"可执行 hook"**：`PreToolUse` 拦截推向 main/master 的 `git push`，exit 2 阻断。
- **`route.json` 建立单一来源**：唯一源在插件内，仓库根为同步产物，由 `scripts/sync-route.mjs --check` 在 CI 校验。
- **补齐本仓 CI**（此前 `.github/` 不存在，本仓自身违反 RULE 2）：prettier + JSON 语法 + plugin validate + route 一致性 + 守则副本检查。
- **子仓接入成本压到 6 行 `.claude/settings.json`**，并提供 `/adopt` skill 自动完成接入与存量收敛。

## 3. 影响范围

| 仓库                                                  | 影响文件 / 模块                                              | 由谁落地               |
| ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| `workflow-control-tower`                              | 新增插件与 CI；`team/` 收敛；`route.json` 建立单一来源       | control-tower          |
| `openIndu-website`                                    | `.claude/settings.json`；删 `governance/principle.md` 副本   | infra-deploy agent     |
| `openIndu-platform`                                   | `.claude/settings.json`；删 `PRINCIPLE.md` 与重复治理 agent  | 待指派（无专属 agent） |
| `openIndu-backend` / `-admin` / `-portal`             | `.claude/settings.json`；CLAUDE.md Rule #1 指向 `/principle` | backend / frontend     |
| `openIndu-studio` / `-controller` / `openindu-vision` | `.claude/settings.json`                                      | 待指派                 |
| `infra-deploy`                                        | `.claude/settings.json`（Gitee，PR 用英文 RULE 9）           | infra-deploy agent     |

**本 spec 的阶段 1 只改 `workflow-control-tower`**，其余仓在阶段 2 逐个接入。

## 4. 实施路径（HOW）

### 阶段 1 — 建立公共插件（本轮）

- 起点：`workflow-control-tower` 无任何 Claude Code 原生资产
- 改动：
  - 新增 `.claude-plugin/marketplace.json` + `plugins/openindu-workflow/`（7 skill / 7 agent / 1 hook / reference）
  - `team/agents/*.md`、`team/manifest.yaml`、`team/launch.sh` 迁入插件后删除
  - `team/principle.md` 改为指针；重写 `team/README.md`、`team/STARTUP.md`
  - 补 `team/communications/`（此前全仓引用但目录不存在）
  - 新增 `scripts/sync-route.mjs` + `.github/workflows/ci.yml` + `.prettierignore`
  - 修复 `route.json` 未转义引号导致的 JSON 语法错误
- 验收：见第 6 节 1-6 项
- 回滚：`git revert` 该 PR。插件未发布前无下游依赖，回滚无外部影响

### 阶段 2 — 子仓逐个接入（下一轮）

- 起点：插件已合入 main
- 改动：每个仓跑 `/adopt` → 写 `.claude/settings.json` → Rule #1 指向 `/principle` → 列出重复资产由**用户确认**后删除 → 各提一个 PR
- 顺序：先 `openIndu-website`（聚合仓，影响面最大）→ `openIndu-platform`（副本最多）→ 其余
- 验收：每仓 `/principle` 可调用；`/plugin list` 含 `openindu-workflow@openindu`；仓内无守则副本
- 回滚：单仓 revert 其 PR，不影响其他仓（各仓独立 PR）

### 阶段 3 — 补覆盖缺口（后续）

- `openIndu-studio` / `-platform` / `openindu-vision` / `-controller` 四条产品线暂无专属 agent
- `route.json` 中这四个仓标了 `"aggregate": "openIndu-website"`，但 website 的 `submodules` 只有 backend/admin/portal，字段自相矛盾
- 仓名 `openindu-vision` 全小写与其他 `openIndu-*` 不一致
- 三项均需单独 spec，不并入本 spec

## 5. 回滚方案

| 层级        | 回滚方式                                                     |
| ----------- | ------------------------------------------------------------ |
| 阶段 1      | `git revert` 本 PR。插件未发布，无下游依赖                   |
| 阶段 2 单仓 | revert 该仓的接入 PR；被删的副本可从 git 历史取回            |
| 插件版本    | 下游 `/plugin install openindu-workflow@openindu` 指定旧版本 |
| 紧急停用    | 各仓把 `enabledPlugins` 的值改成 `false`，立即失效           |

保留期：阶段 2 全部完成后 3 个月内不删除任何被替换文件的 git 历史。

## 6. 验收标准

| #   | 标准                                   | 验证方式                                                      |
| --- | -------------------------------------- | ------------------------------------------------------------- |
| 1   | 插件 schema 合法                       | `claude plugin validate ./plugins/openindu-workflow --strict` |
| 2   | 市场目录合法                           | `claude plugin validate . --strict`                           |
| 3   | Markdown 格式通过                      | `npx prettier --check "**/*.md"`                              |
| 4   | `route.json` 与唯一源一致且为合法 JSON | `node scripts/sync-route.mjs --check`                         |
| 5   | push main 被阻断                       | 在测试分支执行 `git push origin main`，应 exit 2              |
| 6   | 7 skill + 7 agent 可见                 | 本地装插件后 `/` 菜单与 `@openindu-workflow:` typeahead       |
| 7   | 本仓不存在第二份守则副本               | CI 的 "Single principle source" 步骤                          |
| 8   | （阶段 2）各仓 `/principle` 输出 11 条 | 逐仓人工验证                                                  |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 守则遵守（11 条任一条） | ✅ 本 spec 正是为落实 RULE 1 而设；RULE 2 由新增 CI 补齐；RULE 7 由 hook 强化；全程走分支 + PR                                                                                                               |
| 跨仓契约对齐            | ✅ 接入契约是 `.claude/settings.json` 的 `extraKnownMarketplaces` + `enabledPlugins` 两个键，显式且版本化                                                                                                    |
| 与已定稿 spec 冲突检查  | ✅ `spec/` 此前为空（仅 README + TEMPLATE），无已定稿条目，无冲突                                                                                                                                            |
| 最小改动                | ⚠️ → ✅ 阶段 1 变更量超 RULE 4 的 400 行上限。理由：新建独立目录树而非修改既有模块，已按阶段拆为 3 段，阶段 2 每仓 PR 均远低于上限。**例外已经用户批准**（threads/task-20260803-001/002-review_decision.md） |
| 回滚路径                | ✅ 三个层级均可回滚，见第 5 节                                                                                                                                                                               |

## 8. 待解决问题

- [x] 阶段 1 的变更量例外 —— **2026-08-03 经用户批准**（`threads/task-20260803-001/002-review_decision.md`）
- [ ] `openIndu-platform` 的 13 个 agent 中，`test-engineer` / `reviewer` / `pgsql-helper` 等是否值得上收为公共资产？本 spec 的立场是**暂不上收**——公共层提供的是治理 agent，对这些专业开发 agent 没有等价物，删掉是净损失。上收需单独 spec 评估其 Python 脚本依赖
- [ ] 四条产品线的专属 agent 由谁定义、何时定义
- [ ] `route.json` 中 `aggregate` 字段的语义矛盾如何修正（阶段 3）
- [ ] 插件版本策略：是否需要 pre-release 通道供 control-tower 先行验证

## 9. 变更记录

| 日期       | 变更内容                            | 关联 revision                            |
| ---------- | ----------------------------------- | ---------------------------------------- |
| 2026-08-03 | 初始草稿                            | 2026-08-03-shared-plugin-distribution.md |
| 2026-08-03 | 用户审核通过，RULE 4 例外获批，定稿 | 同上                                     |
