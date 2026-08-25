---
date: 2026-08-04
slug: roster-cleanup-and-spec002-closure
type: agent
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# stage-4 改名残留清理 + spec/002/003 执行顺序闭合

## 变更摘要

> spec/003 阶段 4 把交付域按语言重建（backend→python、frontend→web-react+web-vue、infra-deploy→release）后，多处文档与清单仍引用旧席名 / "7 个 agent" / "frontend 2 副本"。本轮把改名残留全部对齐到 16 席，并把 spec/003 §8 两个 open item 闭合、spec/002 status 推进至 under_review，明确 platform 仓本轮只删 L1 重复 + L0 垃圾，L3 重叠走单独 spec。同时把 RULE 10 里的生产 IP 外迁到 route.json 数据层，新增 CI 席位对账脚本。

## 涉及文件

| 文件                                                   | 改动类型 | 说明                                                                                                                             |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-workflow/.claude-plugin/plugin.json` | 修改     | description "7 个治理 agent" → 16 席；version 2.0.0 → 2.1.0                                                                      |
| `.claude-plugin/marketplace.json`                      | 修改     | 同上                                                                                                                             |
| `plugins/openindu-workflow/README.md`                  | 修改     | Agents 表 7 行 → 16 行；首句 "一套治理 agent" → 16 个 maintainer agent                                                           |
| `CLAUDE.md`                                            | 修改     | 分发图 "7 agent" → 16；"7 个 maintainer agent" → 16                                                                              |
| `plugins/openindu-workflow/agents/manager.md`          | 修改     | 直接下级 / 并行规则 / 流程图 / spawn 规则 / 行为约束里的 "frontend 2 副本" 与 "infra-deploy agent" 全部改为新名与 spawn 参数模型 |
| `plugins/openindu-workflow/reference/manifest.yaml`    | 修改     | escalation `to: infra-deploy agent` → `release`；spawn_configs.frontend 块重写为 multi_repo_same_seat（spec/003 §2.4）           |
| `team/README.md`                                       | 修改     | "一类仓库一名 agent"旧名清单 → 16 席；"参考现有 7 个 agent" → 16                                                                 |
| `plugins/openindu-workflow/skills/launch/SKILL.md`     | 修改     | manager 启动 prompt 里 "frontend 2 副本" → web-react + repo= 参数                                                                |
| `plugins/openindu-workflow/skills/adopt/SKILL.md`      | 修改     | 收敛边界旧治理席名清单 → 16 席 + platform L3 上收边界说明                                                                        |
| `spec/003-agent-org-design.md`                         | 修改     | §8 两个 open item 闭合；§9 加 changelog                                                                                          |
| `spec/002-agent-consolidation.md`                      | 修改     | status draft→under_review；§9 加执行顺序闭合记录                                                                                 |
| `plugins/openindu-workflow/reference/route.json`       | 修改     | openIndu-backend 新增 production_db 字段（IP/端口/库名落数据层）                                                                 |
| `plugins/openindu-workflow/skills/principle/SKILL.md`  | 修改     | RULE 10 正文生产 IP/库名 → 引用 /route                                                                                           |
| `scripts/check-roster.mjs`                             | 新增     | 席位数对账 + 旧 agent 名禁用扫描                                                                                                 |
| `.github/workflows/ci.yml`                             | 修改     | 新增 roster 一致性校验步骤                                                                                                       |
| `skills/README.md`                                     | 修改     | 顶部加 opencode / Claude Code 双轨说明                                                                                           |
| `route.json`                                           | 修改     | sync 产物，由 sync-route.mjs 同步                                                                                                |

## 触发原因

> spec/003 finalized 后的 stage-4 破坏性改名（v1.1.0→2.0.0）留下多处文档/清单漂移：plugin/marketplace description 仍写"7 个治理 agent"、plugin README Agents 表只 7 行、manager.md 仍 spawn 不存在的 `frontend` 席与 `infra-deploy agent`、manifest escalation 指向旧名。CI 抓 route.json 漂移很到位，却没有"文档席位数 == agents/ 文件数"对账，于是文档漂移未被机器捕获——正是 spec/003 §1.1 批评的同类病。同时 spec/002(draft) 与 spec/003(finalized) 执行顺序未闭合，platform 的 9 个 L3 本地 agent 与新公共席重叠未归位。

## 影响评估

| 影响范围    | 说明                                                                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 下游        | 本次 bump 2.0.0 → 2.1.0（minor：新增 check-roster.mjs CI 脚本；其余为文档/清单修复与 principle IP 外迁）。下游 `/plugin update` 可拿到对齐后的 16 席描述与去实例化的 RULE 10 |
| platform 仓 | 本轮在 openIndu-platform 跑 `/adopt` 删 4 个 L1 重复 + L0 垃圾；4 个语言重叠 L3 不删（走 spec/002 §8 单开 spec）                                                             |
| 回滚方法    | `git revert` 本 PR；下游可 `/plugin install openindu-workflow@openindu@2.0.0` 回退                                                                                           |

## 验证记录

- [ ] `npx prettier --check "**/*.md"` 通过
- [ ] `node scripts/sync-route.mjs --check` 通过
- [ ] `node scripts/detect-modules.mjs --check` 通过
- [ ] `node scripts/check-roster.mjs` 通过（新增）
- [ ] `claude plugin validate ./plugins/openindu-workflow --strict` 通过（如本机无 claude CLI 则跳过）
- [ ] arbiter 审核通过（如适用）
