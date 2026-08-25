---
date: 2026-06-25
slug: init-openindu-control-tower
type: other
related_spec: —
author: control-tower (Claude)
pr: —
---

# init: openIndu workflow-control-tower 仓库初始化

## 变更摘要

初始化 openIndu 社区的管控层仓库 `workflow-control-tower`，作为 openIndu 全社区 AI Agent 的"大脑"——维护路由信息、Agent 行为守则、Agent prompt 与编排，统一指挥业务子仓的基础设施更新。

## 涉及文件

| 文件                                        | 改动类型 | 说明                                                                                                |
| ------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `README.md` `CLAUDE.md`                     | 新增     | 项目入口文档                                                                                        |
| `route.json`                                | 新增     | openIndu 5 个仓库（4 GitHub 业务 + 1 Gitee infra-deploy）的路由信息                                 |
| `team/principle.md`                         | 新增     | 11 条 Agent 行为守则                                                                                |
| `team/manifest.yaml`                        | 新增     | 7 agent 编排（manager / arbiter / control-tower / backend / frontend×2 / infra-deploy / inspector） |
| `team/README.md` `team/STARTUP.md`          | 新增     | 团队系统说明 + 启动指南                                                                             |
| `team/launch.sh`                            | 新增     | `openindu-maintainers` 团队一键启动脚本                                                             |
| `team/agents/*.md`                          | 新增     | 7 个 agent 完整定义 + `_TEMPLATE.md` + `README.md`                                                  |
| `spec/README.md` `spec/TEMPLATE.md`         | 新增     | 特性设计目录与模板                                                                                  |
| `revision/README.md` `revision/TEMPLATE.md` | 新增     | 修订记录目录与模板                                                                                  |

## 触发原因

用户请求：为 openIndu 社区建立独立的 AI Agent 管控层，统一维护准则、路由、agent 定义，与业务仓库解耦。

经评审拍板（3 个二选一）：

1. 位置 → `../openIndu-workflow-control-tower`（与 openIndu-website 同级独立仓）
2. Agent 数 → 7 个（合并 admin+portal 为 frontend 副本模式，匹配现有 `.claude/agents/` 分工）
3. principle.md → 11 条 RULE：RULE 1-6 通用 AI Agent 操作纪律 + RULE 7-11 openIndu 社区硬约束

## RULE 7-11 来源

| RULE | 来源（用户记忆 / CLAUDE.md / 实战教训）                                                |
| ---- | -------------------------------------------------------------------------------------- |
| 7    | `feedback_git_workflow` — 禁止直接 push main，所有修改走 PR                            |
| 8    | aggregate `CLAUDE.md` — K8s 部署清单归口 openIndu/infra-deploy                         |
| 9    | `feedback_gitee_pr_encoding` — Gitee API 创建 PR 时 title/body 用英文                  |
| 10   | `feedback_guarded_production_sql` — 多列 WHERE + BEFORE/AFTER + rowcount + 条件 commit |
| 11   | `feedback_post_fix_workflow` — 修复完整链路：PR→合并→子模块→rebuild                    |

## 影响评估

| 影响范围                   | 说明                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| openIndu 全社区 agent      | 全部 agent 必须以本仓 `team/principle.md` 为 Rule #1 源头        |
| openIndu-website CLAUDE.md | Rule #1 引用迁移到本仓（已在 openIndu/openIndu-website#89 完成） |
| 回滚                       | 删除仓库即可，不影响业务子仓                                     |

## 验证记录

- [x] 目录结构生成完成（CLAUDE.md / README.md / route.json / spec/ / revision/ / team/）
- [x] 7 个 agent 定义文件齐全
- [x] principle.md 11 条 RULE 完整
- [ ] `prettier --check` 验证 markdown 格式（用户在 npm install 后执行）
- [ ] arbiter 审核（仓库初始化属于自举，无需审核）
- [x] 下游同步（openIndu-website CLAUDE.md / `.claude/governance/principle.md` 已通过 PR #89 更新权威源 URL）
