---
date: 2026-08-04
slug: stage-4-language-seats
type: agent
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 阶段 4 完成：16 席全部落地（v2.0.0 破坏性变更）

## 变更摘要

spec/003 的全部 16 席落地。**破坏性**：`backend` → `python`、`frontend` → `web-react` + `web-vue`、`infra-deploy` → `release`。无子仓接入，唯一消费者是 control-tower 自身——因此破坏性没有实际下游影响。

## 席位变迁

| 原席位         | 新席位                  | 原因                                              |
| -------------- | ----------------------- | ------------------------------------------------- |
| `backend`      | `python`                | 去仓库名，按语言命名                              |
| `frontend`     | `web-react` + `web-vue` | 拆分。React 151 / Vue 277，组件模型与范式完全不同 |
| `infra-deploy` | `release`               | 它的职责是交付链路，不是某个仓库                  |
| —              | `java`                  | 新增。362 文件 IIoT 底座，此前无人负责            |
| —              | `dotnet`                | 新增。330 文件，唯一直接驱动物理设备的代码        |
| —              | `rust`                  | 新增。在途重写，协议层风险密度最高                |
| —              | `test`                  | 新增。RULE 2 准入门槛                             |
| —              | `reviewer`              | 新增。RULE 5.2 四视角预审                         |
| —              | `security`              | 新增。RULE 5.4 整节                               |
| —              | `product`               | 新增。需求 / 验收标准 / 跨仓契约                  |
| —              | `data`                  | 新增。RULE 10 整条                                |

**16 席 = 治理 3 + 规范 1 + 质量 3 + 语言 6 + 链路 1 + 产品 1 + 数据 1。**

## 交付域 6 席的设计要点

| 席位        | 语言       | 规模         | 关键设计                                                                                       |
| ----------- | ---------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `python`    | Python     | 285 文件     | 覆盖社区后端 + 采集器 + studio。形态不同但栈一致。将背靠背的踩坑记录保留                       |
| `java`      | Java       | 362 文件     | 组织最大自研代码体。诚实声明管控层尚未收录其构建/测试/配置约定，要求先读代码再动手             |
| `dotnet`    | C#         | 330 文件     | 唯一驱动物理设备的席位——运动/激光/点胶出错的代价不是 500 是撞机。默认按 L3。含 PLC4X fork 纪律 |
| `web-react` | TS/React   | 151 文件     | 社区对外门面。继承前端席的知识资产（踩坑记录、SEO 约定）                                       |
| `web-vue`   | Vue/UniApp | 277 文件     | platform 前端。此前完全无人负责。含 UniApp 多端特殊性说明                                      |
| `rust`      | Rust       | 0 文件(main) | 在途重写。明确告知 main 上 Rust 是 0，要在正确分支上工作。协议层出错不会崩只会静默产错数据     |

## 非交付域 3 席的设计要点

| 席位      | 对应守则    | 关键设计                                                   |
| --------- | ----------- | ---------------------------------------------------------- |
| `release` | RULE 8/9/11 | 原名 `infra-deploy`。不再有特定仓库名。六段链路兜底        |
| `product` | RULE 5.3    | 回答"要建什么"。验收标准必须可判定，每条需求写明"不做什么" |
| `data`    | RULE 10     | 出方案，人执行。绝不自行对生产库写。五道防护一道不少       |

## 新增 `by_language` 任务路由

按 `route.json` 的模块语言自动派活——加一个同语言仓库不需要改路由。

## 涉及文件

| 文件                                                                                                   | 改动                              |
| ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `plugins/openindu-workflow/agents/{python,java,dotnet,rust,web-react,web-vue,release,product,data}.md` | 新增 9 个                         |
| `plugins/openindu-workflow/agents/{backend,frontend,infra-deploy}.md`                                  | 删除 3 个                         |
| `plugins/openindu-workflow/reference/manifest.yaml`                                                    | 重写 roster、agent 清单、任务路由 |
| `plugins/openindu-workflow/agents/{control-tower,manager,arbiter,data}.md`                             | 更新人数与引用                    |
| `README.md` `CLAUDE.md` `team/README.md`                                                               | 席位表与目录树                    |
| `plugins/openindu-workflow/README.md` `skills/launch` `skills/adopt`                                   | 7→16                              |
| `plugin.json` `marketplace.json`                                                                       | **1.1.0 → 2.0.0**                 |

## 影响评估

| 影响范围 | 说明                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| 下游     | **零影响。** 无任何子仓接入插件，改名没有破坏实质性引用                                        |
| 破坏性   | 理论上：旧 agent 名（`backend`/`frontend`/`infra-deploy`）从命名空间消失。实际上：从未被调用过 |
| 版本     | 2.0.0，表示破坏性改名。但无需 migrate——用户从未以旧名引用过                                    |
| 数量     | 插件 agent 定义 10→16；manifest agent 条目 10→16                                               |

## 验证记录

- [x] `prettier --check` / `sync-route --check` / `detect-modules --check` 通过
- [x] `claude plugin validate` 插件与市场均通过
- [x] 16 个 agent `.md` 均在位，每个都有合法 frontmatter（`name` + `description`）
- [x] 旧名引用已全面更新（保留历史叙述中的"旧的 backend 席"措辞用于过渡说明）
- [x] 任务路由新增 `by_language` 字段，与 `detect-modules.mjs` 的输出对应
- [ ] agent 的实际调用效果——需重启会话后人工验证
- [ ] `/plugin update` 从 1.1.0→2.0.0 的升级体验——安装的仍是本地缓存（版本固定为缓存目录下的 1.0.0），需在重启后重新安装
