---
date: 2026-08-04
slug: role-aware-roster-and-skill-consolidation
type: agent
related_spec: 002-agent-consolidation
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# role 字段 + /launch 语言感知选人 + codebase-analysis 上收进插件

## 变更摘要

> 回应"agents 能否按角色定义 / skills 是否并入插件"两问。给 16 个 agent frontmatter 加 `role`（delivery 席加 `language`）作为 /launch 选人键；/launch 改为按 route.json 的本仓语言激活相关交付席子集，不全量 spawn；根 `skills/codebase-analysis` 上收进 `plugins/openindu-workflow/skills/`（spec/002 §8 open item 闭合），根 `skills/` 删除。版本 2.1.0 → 2.2.0。

## 涉及文件

| 文件                                                          | 改动类型 | 说明                                                                                                      |
| ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-workflow/agents/*.md`(16 个)                | 修改     | frontmatter 加 `role`（meta/repo/delivery/quality/audit/release/product/data）；delivery 席加 `language`  |
| `plugins/openindu-workflow/skills/launch/SKILL.md`            | 修改     | 新增"步骤 2 确定本仓活跃席位"：按 route.json 语言激活交付席；manager prompt 用活跃席位清单替代"16 个待命" |
| `plugins/openindu-workflow/skills/codebase-analysis/SKILL.md` | 迁入     | 从根 `skills/` 移入插件；description 加单引号包裹以修 YAML 冒号解析                                       |
| `skills/`(README + codebase-analysis)                         | 删除     | 根 skills 目录整体删除，skill 统一经插件分发                                                              |
| `plugins/openindu-workflow/reference/manifest.yaml`           | 修改     | skills 清单加 codebase-analysis                                                                           |
| `CLAUDE.md` / `README.md`                                     | 修改     | 目录结构移除根 skills/；README 删除"新增 opencode skill"条目                                              |
| `scripts/check-roster.mjs`                                    | 修改     | 新增 role 字段存在性 + 合法性 + delivery 必有 language 校验；扫描目标移除根 skills/README                 |
| `spec/002-agent-consolidation.md`                             | 修改     | §8 codebase-analysis 上收 open item 闭合；§9 加 changelog                                                 |
| `plugins/openindu-workflow/.claude-plugin/plugin.json`        | 修改     | version 2.1.0 → 2.2.0                                                                                     |
| `.claude-plugin/marketplace.json`                             | 修改     | plugins[0].version 2.1.0 → 2.2.0                                                                          |

## 触发原因

> 用户两问：① agents 能否按角色定义 ② skills 是否需要并入插件而非独立。诊断：16 个 agent 已有 manifest `type` 即角色，10/16 是纯角色、6 是 delivery 角色的语言特化；spec/003 §2.1 论证过不合并 6 语言席（通用 delivery 会丧失栈深度），故采"保留席位 + role 感知选人"。codebase-analysis 是工具无关方法论，放根 skills/（opencode）等于 Claude Code 用户发现不到，spec/002 §8 已列为 open item。

## 设计决策

| 决策                           | 理由                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 不合并 6 语言席为通用 delivery | spec/003 §2.1：Spring Boot 与 FastAPI 的地道知识不同，通用 agent 在每栈都平庸。栈知识是席位价值，不是耦合  |
| 加 `role` 字段作选人键         | 让 agent 自描述角色，/launch 可机器判定常驻 vs 按语言激活                                                  |
| /launch 只激活相关子集         | 解决"下游仓装插件就拿到 16 个 agent"的噪声——Claude Code 插件无法按仓条件分发 agent 文件，故在 spawn 时选人 |
| codebase-analysis 上收进插件   | 工具无关方法论，并入后全组织经插件拿到 `/codebase-analysis`；根 skills/ 无其他内容，删除                   |

## 活跃席位规则（/launch）

| 域                            | 席位                                                                                | 常驻                  |
| ----------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| 治理/规范/质量/链路/产品/数据 | manager/arbiter/inspector/control-tower/test/reviewer/security/release/product/data | ✅ 常驻               |
| 交付                          | python/java/dotnet/web-react/web-vue/rust                                           | ⛔ 仅当本仓含对应语言 |

## 影响评估

| 影响范围 | 说明                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 下游     | minor bump 2.1.0→2.2.0；下游 `/plugin update` 拿到 role 字段、语言感知 /launch、`/codebase-analysis` skill |
| 平台     | 不影响 platform 仓已合入的 /adopt PR（platform 用旧 /launch 仍可工作，升级后更精准）                       |
| 回滚     | `git revert` 本 PR；下游可 `/plugin install openindu-workflow@openindu@2.1.0`                              |

## 验证记录

- [x] `npx prettier@3.9.6 --check "**/*.md"` 通过
- [x] `node scripts/sync-route.mjs --check` 通过
- [x] `node scripts/detect-modules.mjs --check` 通过
- [x] `node scripts/check-roster.mjs` 通过（含新增 role 校验）
- [x] `npx @anthropic-ai/claude-code@latest plugin validate ./plugins/openindu-workflow --strict` 通过
- [x] `npx @anthropic-ai/claude-code@latest plugin validate . --strict` 通过
- [ ] /launch 语言感知选人的实际效果——需重启会话后人工验证
