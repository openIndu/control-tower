---
date: 2026-08-03
slug: delivery-domain-by-stack
type: other
related_spec: 003-agent-org-design
author: control-tower
pr: openIndu/workflow-control-tower#TBD
---

# 交付域改为按语言编制；修正「栈无关参数化」的错误设计

## 变更摘要

`spec/003` 初稿把交付域设计成 4 个**栈无关**席位（`service` / `web` / `edge` / `runtime`），机制是「agent 定义不写技术栈，运行时读该仓 CLAUDE.md 特化」。

用户指出交付域不该按前后端切，应该按语言（Python / Java / Golang / C# 等资深工程师）编制。**采纳，并且实测证据显示初稿的问题比批评更严重。**

改为按语言编制 5 席：`java` / `python` / `web` / `dotnet` / `rust`。

## 实测语言普查（2026-08-03，本机已 clone 的 4 个仓）

| 语言      | 源文件数      | 分布                                                                    |
| --------- | ------------- | ----------------------------------------------------------------------- |
| TS/JS/Vue | 428           | 社区 admin+portal、platform 的 app / website / website-next             |
| Java      | 362           | `platform/openindu-backend`（Spring Boot + Maven）                      |
| Python    | 252           | 社区后端（FastAPI）、`platform/openindu-collector`、`studio/converters` |
| C#        | 110           | `openIndu-controller`（3 个 `.csproj`，.NET）                           |
| **Rust**  | 13（1460 行） | `platform/openindu-gateway`（Modbus 驱动、边缘告警、数据变换）          |
| **Go**    | **0**         | 全组织无任何 `go.mod`                                                   |

用户提到的 Golang 组织并不使用；而**没人提到的 Rust 是真实在用的**，且是风险密度最高的代码（工业协议实现出错不会崩，只会静默产生错数据）。

## 顺带发现的结构性问题（spec/003 新增问题 ⑧）

`openIndu-platform` 在 `route.json` 里是**一个**条目、**一个** type（`platform`）。实际是 **6 个子模块、4 种语言**的 monorepo：

| 子模块                  | 构建清单         | 语言       | 源文件 |
| ----------------------- | ---------------- | ---------- | ------ |
| `openindu-backend`      | `pom.xml`        | Java       | 364    |
| `openindu-website`      | `package.json`   | Vue/JS     | 236    |
| `openindu-collector`    | `pyproject.toml` | Python     | 45     |
| `openindu-app`          | `package.json`   | Vue/UniApp | 41     |
| `openindu-website-next` | `package.json`   | TS         | 41     |
| `openindu-gateway`      | `Cargo.toml`     | Rust       | 13     |

一个 type 要同时表示 Java + Vue + Python + Rust，**这个 type 不承载任何信息**。任何「按 repo type 派活」的机制在 platform 上必然失效。路由必须下沉到模块粒度，判据用构建清单文件程序化探测（RULE 3）。

## 涉及文件

| 文件                           | 改动 | 说明                                                                                                      |
| ------------------------------ | ---- | --------------------------------------------------------------------------------------------------------- |
| `spec/003-agent-org-design.md` | 修改 | §1.1 增问题 ⑧；§2.1 重写；§2.2 交付域重建；§2.3 编制总览；实施路径阶段 3-4 重排；验收标准与待解决问题同步 |

## 触发原因

用户对 `spec/003` 交付域设计的直接质疑：「交付域不应该前后端，包括 python、java、golang、c# 等资深工程师吗？」

## 影响评估

| 影响范围       | 说明                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| 编制规模       | 13 席 → **15 席**（交付域 4→5）。§2.3 同时给出 12 席的精简方案                                |
| 实施顺序       | 新增「阶段 3 模块级路由」，且**必须先于**语言席位落地——否则席位不知道自己管哪些目录           |
| 与 spec/002    | platform 的 `openindu-backend-developer`（Spring Boot）与新的公共 `java` 席高度重合，应当合并 |
| 是否需下游同步 | 否，本次只改 spec 文档                                                                        |
| 回滚方法       | `git revert` 本 PR，spec/003 回到初稿设计                                                     |

## 修正记录（本次推翻了自己上一版的判断）

初稿主张「技术栈应当被抽象掉，由各仓 CLAUDE.md 自述」。这是错的：

- 它把最难的部分（框架惯用法、构建命令、测试框架、依赖管理）推给一个可能很薄甚至不存在的文件，**是没有实质的抽象**
- 与 spec/003 自己批评的「只描述意图不给实现」是同一个毛病

正确的切分是：**该解耦的是仓库实例（10 个且在涨），不是技术栈（5 个且很稳定）。** 治理/质量/流程类席位保持栈无关，交付类席位按语言编制。

## 验证记录

- [x] `npx prettier --check "**/*.md"` 通过
- [x] `node scripts/sync-route.mjs --check` 通过
- [x] `claude plugin validate ./plugins/openindu-workflow --strict` 通过
- [x] 语言普查基于构建清单 + 源文件扩展名双重证据，排除 `node_modules` / `target` / `dist` / `bin` / `obj`
- [ ] arbiter 审核 —— **待办**，spec/003 仍为 `draft`
- [ ] `openindu-vision` 未在本机 clone，其语言未纳入统计，可能引入第 6 席
