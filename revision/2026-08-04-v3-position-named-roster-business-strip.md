---
date: 2026-08-04
slug: v3-position-named-roster-business-strip
type: agent
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# v3.0.0：6 语言席→4 职位席 + 剥离业务知识（依赖倒置修正）

## 变更摘要

> 用户洞察:本仓(大脑)的 agent 定义里塞满了具体仓/服务名(openindu-station/plc4x/openindu-gateway/IIoT 底座/采集器...),是 spec/003 §1.1 反对的依赖倒置——新增/改名一个服务,大脑就得改。修正:agent = 职位(position)+技能(skills)+技巧(techniques),**零业务绑定**;业务绑定留在 route.json(数据)+各仓 CLAUDE.md。同时把 6 语言席合并为 4 职位席(16→14)。反转 spec/003 §2.1 的"6 语言席"决策,依据是更根本的依赖倒置原则。

## 涉及文件

| 文件                                                             | 改动类型 | 说明                                                                                                 |
| ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `agents/{frontend,backend,edge,station-control}.md`              | 新增     | 4 职位 agent,纯技能+技巧+`languages`,零业务绑定                                                      |
| `agents/{java,python,dotnet,web-react,web-vue,rust}.md`          | 删除     | 6 语言席合并进 4 职位席                                                                              |
| `agents/{test,manager,product}.md`                               | 修改     | 剥离业务知识(具体仓名/服务名)→通用                                                                   |
| `agents/control-tower.md`                                        | 修改     | 16→14                                                                                                |
| `reference/manifest.yaml`                                        | 修改     | 4 交付条目(frontend/backend/edge/station-control)+roster 14+by_language 重映射+coverage_notes 去业务 |
| `skills/launch/SKILL.md`                                         | 修改     | 活跃席位规则 16/6→14/4,language→职位映射                                                             |
| `skills/codebase-analysis/SKILL.md`                              | 迁入     | 从根 skills/ 移入插件(承自上一轮)                                                                    |
| `skills/`(根)                                                    | 删除     | 根 skills 目录整体删除,skill 统一经插件分发                                                          |
| `scripts/check-roster.mjs`                                       | 修改     | delivery 校验 language→languages;新增业务知识防回流 guard(具体仓名);旧名禁用改 v2 6 交付席           |
| `README.md` `CLAUDE.md` `team/README.md` `plugins/.../README.md` | 修改     | agent 表 16→14,职位命名,去业务                                                                       |
| `skills/adopt/SKILL.md`                                          | 修改     | 16→14;收敛边界去平台本地 agent 具体名,改通用判据                                                     |
| `plugin.json` `marketplace.json`                                 | 修改     | version 2.2.0→3.0.0;description 16→14                                                                |
| `spec/003-agent-org-design.md`                                   | 修改     | §9 changelog 记录 §2.1 反转                                                                          |

## 触发原因

> 用户:"在这个仓库不能保留业务知识,它只是一个角色,拥有相关技能,不能说它负责哪些服务?这样会出现依赖倒置。" 审计证实:6 交付 agent + test/manager/product 全部塞满具体仓/服务名(~30 处)。这正是 spec/003 §1.1 诊断的依赖倒置,且违反 §2.1"运行时特化的正确形态 = 语言席位 + /route 模块映射 + 该模块 CLAUDE.md(业务语义)"。

## 设计决策

| 决策                              | 理由                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| agent = 职位+技能+技巧,零业务绑定 | 依赖倒置原则:大脑不应知道叶子仓/服务。业务绑定在 route.json + 各仓 CLAUDE.md                                |
| 6 语言席→4 职位席(16→14)          | 文件名=职位(自文档化);多语言技能分小节组织,深度可控;反转 spec/003 §2.1                                      |
| 反转 §2.1 的依据                  | §2.1 否决的是"无栈知识空壳";本模型保留栈知识(skills),只是多语言捆进一个职位 agent。依赖倒置比单栈深度更根本 |
| 新增 CI 业务知识防回流 guard      | check-roster 扫 agent 不得引用具体仓名,防止依赖倒置再次回流                                                 |

## 4 职位席

| 文件            | 职位           | 技能                                             | languages                 |
| --------------- | -------------- | ------------------------------------------------ | ------------------------- |
| frontend        | 前端           | react/vue/uniapp/vite/pnpm/tailwind              | typescript/javascript/vue |
| backend         | 后端           | spring-boot(java)/fastapi(python)                | java/python               |
| edge            | 边缘           | rust/cargo/modbus                                | rust                      |
| station-control | 工位,边缘,上游 | csharp/.NET:运动/视觉/扫码/点胶/激光+控制器+上游 | csharp                    |

- 10 非交付(manager/arbiter/inspector/control-tower/test/reviewer/security/release/product/data),共 14。

## 影响评估

| 影响范围    | 说明                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 下游        | major bump 2.2.0→3.0.0;旧 agent 名(java/python/dotnet/web-react/web-vue/rust)从命名空间消失——但本组织无子仓接入插件,无实际下游引用 |
| platform 仓 | 已合入的 /adopt PR 删的是 L1 重复,不受影响;platform 本地 L3 上收仍走 spec/002 §8                                                   |
| 回滚        | `git revert`;下游可 `/plugin install openindu-workflow@openindu@2.2.0`                                                             |

## 验证记录

- [x] prettier --check(3.9.6)通过
- [x] sync-route --check / detect-modules --check 通过
- [x] check-roster 通过(14 席 + delivery languages + 业务知识防回流 guard + 旧名禁用)
- [x] `claude plugin validate --strict` 插件与市场均通过
- [ ] 4 职位 agent 的实际调用效果——需重启会话后人工验证
- [ ] /launch language→职位激活实际效果——需重启会话后人工验证
