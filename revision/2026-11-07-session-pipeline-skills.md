---
date: 2026-11-07
slug: session-pipeline-skills
type: other
related_spec: —
author: control-tower (Claude)
pr: openIndu/control-tower#117
---

# Session pipeline skills — /retro, /git-commit-push, /cleanup

## 变更摘要

新增三个显式调用（`disable-model-invocation: true`）的会话级 skill，补齐插件在
"会话收尾"环节的缺口：`/retro` 把本次会话中犯的错固化为可复用经验（收割 → 对
lessons store 去重 → 逐条写入 → 治理级缺口只出提案不直接改）；`/git-commit-push`
按各仓库自身规则完成提交 + 推送 + PR（范围/密钥检查、feature 分支、按仓库惯例署
名、RULE 2 lint 前置、单命令 push、Gitee 英文 PR、auto-merge 仓开 Draft、CI 绿才
算 ready）；`/cleanup` 会话收尾（交付物归档到文档约定目录、引用修正 + RULE 6 变
更记录、用户确认后删除一次性产物）。技能集合 22 → 25，版本 5.51.0 → 5.52.0。

## 涉及文件

| 文件                                                             | 改动类型 | 说明                                                       |
| ---------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| `plugins/openindu-control-tower/skills/retro/SKILL.md`           | 新增     | 会话错误经验固化（收割/去重/写入/提案）                    |
| `plugins/openindu-control-tower/skills/git-commit-push/SKILL.md` | 新增     | 提交、推送、开 PR 的仓库规则流水线                         |
| `plugins/openindu-control-tower/skills/cleanup/SKILL.md`         | 新增     | 会话收尾（归档/修引用/确认后删除）                         |
| `plugins/openindu-control-tower/reference/manifest.yaml`         | 修改     | skills 段 +3 条目，计数注释 22 → 25                        |
| `plugins/openindu-control-tower/README.md`                       | 修改     | 命令表 +3 行                                               |
| `AGENTS.md`                                                      | 修改     | 计数 22 → 25（mermaid/标题/目录树）+ Session workflow 小节 |
| `README.md`                                                      | 修改     | 计数 22 → 25（ASCII 图/目录树）+ 命令表 +3 行              |
| `README_ZH.md`                                                   | 修改     | 计数 22 → 25（目录树）+ 命令表 +3 行                       |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`      | 修改     | 版本 5.52.0                                                |
| `.claude-plugin/marketplace.json`                                | 修改     | 版本 5.52.0                                                |
| `.codex-plugin/plugin.json`                                      | 修改     | 版本 5.52.0                                                |
| `.agents/skills/{retro,git-commit-push,cleanup}/SKILL.md`        | 新增     | `sync-codex-skills.mjs --write` 生成                       |
| `revision/2026-11-07-session-pipeline-skills.md`                 | 新增     | 本记录                                                     |

## 触发原因

用户 2026-11-07 直接请求开发三个 openindu-control-tower 流水线 skill（会话错误
经验固化 / git-commit-push / 清理中间态），并确认命名（`/retro`、`/cleanup`，内
置 `/clear` 冲突）与交付方式（直接开发 + PR，轻量路径，同 issue-pipeline 先例；
不动 11 条 RULE）。任务证据：`memory/workflow-runs/openindu/control-tower/tasks/
session-pipeline-skills/`（research-v1 / prod-v1 验收矩阵 A1–A10 / dev-v1 /
test-v1，经 `workflow-state.mjs` 记录）。

## 影响评估

| 影响范围               | 说明                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| 哪些 repo agent 受影响 | 无 agent 变更；全部接入插件的仓库获得 3 个新的显式调用 skill       |
| 是否需要下游同步       | 否——版本号门控，下游 `/plugin update` 自行拉取                     |
| 回滚方法               | revert 本 PR（纯增量：3 个新 skill + 文档行 + 版本号，无可逆迁移） |

## 验证记录

- [x] `npx prettier --check "**/*.md"` 通过
- [ ] arbiter 审核通过（如适用）——不适用：不涉及守则或跨仓契约变更
- [ ] 下游 repo 已同步（如适用）——不适用：版本号门控，无强制同步项
