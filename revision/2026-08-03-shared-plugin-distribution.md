---
date: 2026-08-03
slug: shared-plugin-distribution
type: other # 同时涉及 principle / agent / route / manifest
related_spec: 001-shared-plugin-distribution
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 建立公共插件 openindu-workflow，守则与治理 agent 收敛为单一来源

## 变更摘要

把此前只以文档形式存在的守则、agent 定义、团队编排，全部转成 Claude Code 插件资产（`plugins/openindu-workflow/`），并建立市场目录（`.claude-plugin/marketplace.json`），使全组织所有仓库能通过 6 行 `.claude/settings.json` 零拷贝复用同一份准则。

同时修复三个此前一直存在但没被发现的缺陷：

1. **`route.json` 在 `main` 上不是合法 JSON** —— 自 d129ac9（`feat: add 4 product lines`）起，`openIndu-studio` 的 description 里 `当前的"点"` 用了未转义的 ASCII 双引号，导致整个文件无法被任何 JSON 解析器读取。改用中文引号 `“点”` 修复。
2. **本仓无 CI** —— `.github/` 不存在，但 CLAUDE.md 声称"CI 在 PR 时自动执行 prettier"。本仓自身违反 RULE 2。已补 `.github/workflows/ci.yml`。
3. **`team/communications/` 目录不存在** —— manager / arbiter / inspector 的定义与 STARTUP.md 都要求读写 `threads/{task-id}/` 和 `TASK_LOG.md`，但目录从未创建，通信协议无法落地。已补建。

## 涉及文件

### 新增

| 文件                                                       | 说明                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `.claude-plugin/marketplace.json`                          | 市场目录（name: `openindu`）                             |
| `.claude/settings.json`                                    | 本仓引用公共插件（子仓照抄这 6 行）                      |
| `plugins/openindu-workflow/.claude-plugin/plugin.json`     | 插件清单 v1.0.0                                          |
| `plugins/openindu-workflow/skills/principle/SKILL.md`      | **11 条守则唯一源**                                      |
| `plugins/openindu-workflow/skills/adopt/SKILL.md`          | 子仓接入 + 存量收敛                                      |
| `plugins/openindu-workflow/skills/launch/SKILL.md`         | 取代 `launch.sh`，去 python3 依赖                        |
| `plugins/openindu-workflow/skills/delivery-check/SKILL.md` | RULE 11 交付链路自检                                     |
| `plugins/openindu-workflow/skills/route/SKILL.md`          | 路由查询                                                 |
| `plugins/openindu-workflow/skills/spec-new/SKILL.md`       | 起草 spec                                                |
| `plugins/openindu-workflow/skills/revision-new/SKILL.md`   | 起草修订记录                                             |
| `plugins/openindu-workflow/agents/*.md`（7 个）            | 7 个治理 agent，补齐 YAML frontmatter                    |
| `plugins/openindu-workflow/hooks/hooks.json`               | `PreToolUse` 匹配 `Bash\|PowerShell`                     |
| `plugins/openindu-workflow/hooks/block-push-main.mjs`      | 阻断 push main/master（RULE 7）                          |
| `plugins/openindu-workflow/reference/route.json`           | **路由唯一源**                                           |
| `plugins/openindu-workflow/reference/manifest.yaml`        | 团队编排配置（路径更新 + 覆盖缺口标注）                  |
| `plugins/openindu-workflow/README.md`                      | 插件说明                                                 |
| `scripts/sync-route.mjs`                                   | route.json 同步 / `--check` 校验                         |
| `.github/workflows/ci.yml`                                 | prettier + JSON + plugin validate + route + 守则副本检查 |
| `.prettierignore`                                          | 排除运行期 threads                                       |
| `team/communications/TASK_LOG.md`                          | 任务汇总日志                                             |
| `team/communications/threads/.gitkeep`                     | 通信目录占位                                             |
| `spec/001-shared-plugin-distribution.md`                   | 本次变更的设计文档                                       |

### 修改

| 文件                | 改动                                                          |
| ------------------- | ------------------------------------------------------------- |
| `route.json`        | 修复未转义引号导致的 JSON 语法错误；改为同步产物              |
| `team/principle.md` | 219 行守则正文 → 12 行指针，指向插件内唯一源                  |
| `team/README.md`    | 重写：资产迁移位置对照表 + 新增 agent 流程                    |
| `team/STARTUP.md`   | 重写：前置接入插件、`/principle` 取代读文件、故障排查补插件项 |
| `CLAUDE.md`         | 仓库数 5 → 10；"下发更新"改为插件分发机制；目录结构更新       |
| `README.md`         | 增"快速接入"；仓库全景补全 10 个；架构图改为插件分发          |

### 删除（内容已迁入插件）

| 文件                                             | 去向                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| `team/agents/*.md`（7 个 + README + \_TEMPLATE） | `plugins/openindu-workflow/agents/`                 |
| `team/manifest.yaml`                             | `plugins/openindu-workflow/reference/manifest.yaml` |
| `team/launch.sh`                                 | `plugins/openindu-workflow/skills/launch/SKILL.md`  |

## 触发原因

用户提出：基于本仓建立公共的 team / skill / agent / spec，供 `github.com/openIndu` 整个组织引用复用。

评审后确认现状不具备被复用的能力——本仓没有任何 Claude Code 能加载的资产，`team/agents/*.md` 缺 frontmatter 永远无法注册为 agent，Rule #1 的 `../principle.md` 相对路径在任何子仓都不可解析。扫描发现三份互不相同的守则副本已经存在（11 条 / 6 条 / 0 条 RULE 标题）。

设计决策记录在 `spec/001-shared-plugin-distribution.md`。

## 影响评估

| 影响范围            | 说明                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| 受影响的 repo agent | 全部 7 个——定义位置从 `team/agents/` 移到插件内，调用方式从读文件改为 `@openindu-workflow:<id>`       |
| 是否需要下游同步    | **是**。10 个仓需各自接入（spec 001 阶段 2），每仓跑 `/adopt` 并提 PR。本轮未改动任何子仓             |
| 对现有工作流的影响  | `/launch` 从"文档里的幽灵命令"变成真实可调用；`git push origin main` 从"文字约定"变成会被 exit 2 阻断 |
| 回滚方法            | `git revert` 本 PR。插件未发布，无下游依赖，回滚无外部影响                                            |
| 破坏性              | `team/agents/` 与 `team/launch.sh` 的路径引用会失效。已在 `team/README.md` 提供位置对照表             |

## 验证记录

- [x] `npx prettier --check "**/*.md"` 通过
- [x] `claude plugin validate ./plugins/openindu-workflow --strict` 通过
- [x] `claude plugin validate . --strict` 通过（市场目录）
- [x] `node scripts/sync-route.mjs --check` 通过；`route.json` 与唯一源均为合法 JSON
- [x] push-main hook 12 个用例全部符合预期（含复合命令、`HEAD:master`、`+refs/heads/main`、裸 push 在 main 上）
- [ ] arbiter 审核通过 —— **待办**，spec 001 仍为 `draft`
- [ ] 下游 repo 已同步 —— **待办**，属 spec 001 阶段 2
