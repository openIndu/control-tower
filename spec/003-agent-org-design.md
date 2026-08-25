---
spec_id: 003-agent-org-design
title: Agent 组织架构重构——按能力编制，与仓库数量解耦
status: finalized # draft | under_review | revision_required | finalized | superseded
author: control-tower
created: 2026-08-03
updated: 2026-08-03
supersedes:
related_repos:
  - workflow-control-tower
related_rules:
  - RULE 1
  - RULE 2
  - RULE 3
  - RULE 4
  - RULE 5
  - RULE 10
---

# Agent 组织架构重构——按能力编制，与仓库数量解耦

## 1. 背景（WHY）

### 1.1 现行团队架构的九个问题

**① 编制按仓库切分，不按能力切分——这与「仓库全景」是同一个依赖倒置**

7 席里有 4 席（`control-tower` / `backend` / `frontend` / `infra-deploy`）是按**具体仓库**定义的。后果是三重的：

- 组织实际有 **15 个仓**（14 GitHub + 1 Gitee），编制只覆盖到其中 5 个
- `openIndu-platform` 用 Spring Boot + Vue3，插件的 `backend`（FastAPI）/ `frontend`（React）完全用不上，只能自己再造——**这正是 platform 长出 13 个本地 agent 的根因**，不是它不守规矩
- 每新增一个仓就要问「谁来管」，答案要么加一席、要么硬塞给现有席位

**② 治理层过重，交付层过轻**

| 域           | 席位                              | 占比    |
| ------------ | --------------------------------- | ------- |
| 纯治理       | manager / arbiter / inspector     | 3/7     |
| 管控自维护   | control-tower                     | 1/7     |
| **实际交付** | backend / frontend / infra-deploy | **3/7** |

**57% 的编制不产出交付物。** 而交付侧还缺：测试、代码审查、安全、数据迁移、API 契约、需求。

**③ arbiter 是没有终审权的瓶颈**

每个标准通道任务都要过 arbiter，但 RULE 5.2 明写「不要让另一个 agent 作为唯一评审人通过 L2 及以上变更」。所以 arbiter 审完**仍然要人审**——它只增加了一跳延迟，没有换来任何授权。

巡检提案的路径是 `inspector → manager → arbiter → 用户 → repo agent`，**4 跳**才能动一行代码。

**④ 架构图画成树，运行时其实是平的**

Team 是 flat 结构，manager 不能 spawn teammate，只能 spawn 普通 subagent，而 subagent 无法回传消息（只能写文件）。文档里那张三层树在运行时并不存在，manager 实际做的是「一次性 fan-out + 读文件聚合」。**画树是误导。**

**⑤ 违反自己的 RULE 3**

RULE 3 要求「只升到刚好满足需求那一级」，7 级里 agent 是最后一级。但现行默认路径是 `manager → arbiter → repo agent` 的 orchestrator-workers（**第 6 级**），连「改个 Dockerfile 的一行」都走这条。绝大多数场景第 1 级（脚本）或第 2 级（脚本 + 单次 LLM）就够了。

**⑥ `frontend` 把运行时并发写进了角色身份**

「2 副本」是 spawn 参数，不是 agent 的身份属性。写进定义的结果是：再来一个前端仓就得改定义。

**⑦ 每个 agent 对「文件」负责，没有 agent 对「能力」负责**

现行定义的核心是「可写文件清单」——那是**权限模型**，不是**职责模型**。于是没有任何一席需要为「这个仓的测试能不能支撑回归判断」（RULE 2 的准入门槛）或「这个 API 的契约有没有破坏下游」（RULE 5.3）负责。

**⑧ `route.json` 的粒度是「仓库」，但组织里有多语言 monorepo——路由根本指不到干活的单元**

`openIndu-platform` 在 `route.json` 里是**一个**条目、**一个** type（`platform`）。实际扫描：

| 子模块                  | 构建清单         | 语言       | 源文件数 |
| ----------------------- | ---------------- | ---------- | -------- |
| `openindu-backend`      | `pom.xml`        | Java       | 364      |
| `openindu-website`      | `package.json`   | Vue/JS     | 236      |
| `openindu-collector`    | `pyproject.toml` | Python     | 45       |
| `openindu-app`          | `package.json`   | Vue/UniApp | 41       |
| `openindu-website-next` | `package.json`   | TS         | 41       |
| `openindu-gateway`      | `Cargo.toml`     | **Rust**   | 13       |

**一个 type 要同时表示 Java + Vue + Python + Rust 四种栈——这个 type 不承载任何信息。**

后果：任何「按 repo type 派活」的机制在 platform 上必然失效。路由必须下沉到**模块**粒度，判据是构建清单文件（`pom.xml` / `package.json` / `pyproject.toml` / `Cargo.toml` / `*.csproj`）——这是可程序化探测的，不需要人工维护（RULE 3：能用脚本就别用 LLM）。

**⑨ `route.json` 本身就是不完整的——漏了 4 个仓，其中一个是组织内最大的代码体**

2026-08-03 用 `gh repo list openIndu` 对账：组织有 **14 个 GitHub 仓**，`route.json` 只收录 9 个。漏掉的：

| 漏收的仓           | 性质                        | 规模       | 后果                                       |
| ------------------ | --------------------------- | ---------- | ------------------------------------------ |
| `plc4x`            | fork of `apache/plc4x`      | **197 MB** | 组织最大代码体，从不存在于任何编制讨论中   |
| `openindu-station` | **自研** C#，8 个 `.csproj` | 180 个 .cs | 直接驱动物理设备，无人负责且无人知道它存在 |
| `openplc-runtime`  | fork of Autonomy-Logic      | 2.2 MB     | 同上                                       |
| `community`        | 治理文档                    | 5 KB       | 影响小                                     |

更糟的是**已收录条目本身也是错的**：`openindu-vision` 在 `route.json` 里被描述成「用 studio 构建的第一个样板/变现应用」，实际是 **2026-07-01 创建后从未推送的空仓**（`size=0`，无默认分支）。真实的视觉能力在 `openindu-station/src/OpenIndu.Station.Vision/`。

**「大脑」维护的路由表连组织有哪些仓都不准**——这比编制设计得对不对更根本。已在本轮补全并加 CI 校验（`gh repo list` 对账），靠人维护清单必然漂移。

### 1.2 一句话诊断

> 现在的编制是**按仓库画的组织图**，而且那张图还是残缺的（15 个仓只画了 5 个）。仓库会增长，语言不会——**治理类席位按职责编制，交付类席位按语言编制，两者都与仓库数量解耦。**

## 2. 设计要点（WHAT）

### 2.1 核心机制：解耦的是「实例」，不是「技术栈」

**先纠正一个想当然的设计。** 本 spec 初稿提出「agent 定义栈无关，运行时读该仓 CLAUDE.md 特化」——这是错的。它把最难的部分（框架惯用法、构建命令、测试框架、依赖管理）推给一个可能很薄、甚至不存在的文件，**是没有实质的抽象**，与本 spec 批评的「只描述意图不给实现」是同一个毛病。

技术栈**不该**被抽象掉。写地道的 Spring Boot 和写地道的 FastAPI 需要的是不同的知识：依赖注入范式、ORM 惯用法、构建工具（Maven vs uv）、测试框架、错误处理约定。一个"既懂 Java 又懂 Python 又懂 Rust"的通用 `service` 席位，在每种栈上都只能给出平庸建议。

**该解耦的是仓库实例，不是技术栈：**

| 轴          | 数量      | 增长速度        | 适合做编制轴？              |
| ----------- | --------- | --------------- | --------------------------- |
| 仓库实例    | 15 且在涨 | 快（半年 5→15） | ❌ 加仓就要加席             |
| 业务域/分层 | 3-4       | 慢              | ❌ 一个域内含多种不兼容的栈 |
| **语言/栈** | **5**     | **很慢**        | ✅ 组织的技术选型是慎重决策 |

> 自研代码只有 5 种语言（TS/Vue、Java、C#、Python、Rust），而仓库有 15 个——语言轴比仓库轴稳定得多。

所以：**治理/质量/流程类席位保持栈无关，交付类席位按语言编制。** 这既保住了专业深度，又让编制与仓库数量解耦——加一个 Python 仓不需要加席，因为 `python` 席已经在了。

**运行时特化的正确形态：**

```
语言席位（有深度：框架惯用法、构建/测试命令、生态约定）
        +
/route 返回的「模块 → 语言」映射
        +
该模块自己的 CLAUDE.md（业务语义、本地约定）
        ↓
    对某个具体模块的行为
```

> **前提缺口**：`/route` 目前只能到仓库粒度，无法回答「`openIndu-platform/openindu-backend` 用什么栈」。见问题 ⑧。

### 2.2 编制设计（16 席，按域）

每一席的**存在举证**必须回答三问：① 组织里有什么事实需求 ② 现在谁在做 ③ 不设这一席的代价。

#### 治理域（3 席）

| 席位        | 事实需求                                         | 现状               | 不设的代价               |
| ----------- | ------------------------------------------------ | ------------------ | ------------------------ |
| `manager`   | 15 个仓、多任务并行需要编排与人机门禁            | 已有               | 无人做任务分类与 STOP 点 |
| `arbiter`   | 跨仓契约冲突需要按守则裁定                       | 已有，**职责收窄** | 冲突靠拍脑袋             |
| `inspector` | 规范漂移需要主动发现（本次评审就是靠扫描发现的） | 已有               | 缺陷只能等出事才暴露     |

> **arbiter 职责收窄**：不再审核每一次任务分派（那是 manager 的分类工作），只在①跨仓契约冲突 ②spec 定稿 ③inspector 提案定级 三种场景介入。把 4 跳压到 2 跳。

#### 规范域（1 席）

| 席位            | 事实需求                           | 现状 | 不设的代价                   |
| --------------- | ---------------------------------- | ---- | ---------------------------- |
| `control-tower` | 守则/路由/插件/spec 需要唯一维护者 | 已有 | 守则再次分叉（已发生过一次） |

#### 交付域（6 席，**按语言/栈编制**）

交付席位按**语言与工具链**切分，不按"前端/后端"或"业务域"切分。理由见 §2.1。

**自研代码语言分布**（2026-08-04 修订，**基于各仓 default branch**）

> **方法论更正**：初版普查扫的是本机工作树，而本机 `openIndu-platform` 在 `feat/frontend-react-refactor`（领先 main 8 个提交）、`openIndu-studio` 在 `feat/local-rag-mcp`。用 `scripts/detect-modules.mjs`（走 GitHub API 的 default branch）重测后，Python 被低估 29 个文件，Rust 则**在 main 上根本不存在**。
>
> 普查必须以 default branch 为准——这是 `detect-modules.mjs` 的存在理由之一。

| 席位        | 栈                                                 | 覆盖                                                                                               | 规模（源文件） | 现状                         |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------- | ---------------------------- |
| `web-vue`   | Vue 3 / UniApp / Vite / pnpm                       | `platform/openindu-website`、`platform/openindu-app`                                               | **277**        | **无人负责**                 |
| `web-react` | React 19 / TypeScript / Vite / pnpm                | 社区 admin+portal、`platform/openindu-website-next`                                                | **151**        | `frontend` 席                |
| `java`      | Java 17+ / Spring Boot / Maven                     | `platform/openindu-backend`                                                                        | **362**        | **无人负责**                 |
| `dotnet`    | C# / .NET / MSBuild                                | `openindu-station`（8 csproj）+ `openIndu-controller`（3 csproj）+ **`plc4x/plc4net`（上游贡献）** | **330**        | **无人负责**                 |
| `python`    | Python 3.11+ / FastAPI / SQLAlchemy / Alembic / uv | 社区后端、`platform/openindu-collector`、`platform/openindu-gateway`、`studio`                     | **285**        | `backend` 席，仅覆盖社区后端 |
| `rust`      | Rust / Cargo / 工业协议驱动（Modbus）              | `platform/openindu-gateway`（**在途重写，未合并 main**）                                           | **main 上 0**  | **无人负责**                 |

> **`dotnet` 从第 5 升到第 3。** 上一版只算了 `openIndu-controller`（110 文件），漏了 `openindu-station`（180 个 `.cs`、8 个 `.csproj`，含 Motion / Vision / Scan / 点胶 / 激光切割）——因为 `route.json` 根本没收录这个仓。C# 是自研代码里的第三大栈，且是**唯一直接驱动物理设备**的部分。
>
> `openindu-station` 还是**组织内唯一带独立测试工程的仓**（`tests/OpenIndu.Station.Verify`）。

**每席的三问举证**

| 席位        | ① 事实需求                                                                                  | ② 现在谁在做                         | ③ 不设的代价                                                           |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `web-vue`   | platform 的两个前端全是 Vue3/UniApp，277 文件                                               | 无                                   | platform 前端只能继续自建本地 agent                                    |
| `web-react` | 社区门户与后台是对外门面，151 文件                                                          | `frontend` 席                        | 社区站点无归属                                                         |
| `java`      | 最大的单一自研代码体（362 文件），IIoT 底座主服务                                           | 无——`backend` 席写死 FastAPI，用不上 | 护城河代码无人负责，platform 只能继续自建本地 agent                    |
| `dotnet`    | 两个自研 C# 仓 11 个项目 + Apache PLC4X 的 .NET 子项目贡献                                  | 无                                   | 唯一操作物理设备的代码，出错会撞机、废件；且上游贡献会错过 rebase 窗口 |
| `python`    | 四处 Python（社区后端 / 采集器 / studio 工具链）栈一致                                      | `backend` 席，但只认社区后端         | 采集器与 studio 工具链无归属                                           |
| `rust`      | 工业网关正在从 Python 重写为 Rust（已推送 `feat/frontend-react-refactor`，13 文件 1460 行） | 无                                   | 重写落地后无人负责；协议出错不会崩，只会静默产生错数据                 |

> **`rust` 席覆盖的是在途工作**：`main` 上 Rust 文件为 0，13 个 `.rs`（1460 行）在已推送但未合并的 `feat/frontend-react-refactor` 分支上，是 gateway 从 Python 重写为 Rust 的成果。
>
> 用户已拍板保留此席。理由成立——重写一旦合入 main 就立刻需要归属，而协议层代码出错不会崩、只会静默产生错数据，风险密度最高。但要清楚：**这一席现在服务的是未来，不是存量。**

#### 上游 fork：需要的是**策略**，不是席位

初稿在这里提了一个 `fork` 席。**实测数据推翻了它**（2026-08-04，GitHub compare API）：

| 仓库              | 上游                             | 状态       | ahead | behind | 本地改动     |
| ----------------- | -------------------------------- | ---------- | ----- | ------ | ------------ |
| `plc4x`           | `apache/plc4x`                   | `diverged` | **6** | 18     | 49 个文件    |
| `openplc-runtime` | `Autonomy-Logic/openplc-runtime` | `behind`   | **0** | 41     | **0 个文件** |

**`openplc-runtime` 零本地改动**——纯镜像，只是落后 41 个提交。没有任何维护工作量，不需要席位。

**`plc4x` 的 49 个改动文件全是 .NET**：40 个 `.cs` + 6 个 `.csproj` + 1 个 `.sln` + 1 个 `.props` + 1 个 .NET CI workflow，外加 929 行新增测试。改动内容是 net452→net8.0 迁移、SPI3 驱动运行时实现、API 对齐（Field→Tag）、bit codec 与缓冲区修复。

**上游的 Java / Go / Ruby / C 代码，一行都没碰过。**

所以这不是"fork 维护"，是**在 Apache PLC4X 的 .NET 子项目上做 C# 开发**——归 `dotnet` 席，不需要新席位。同时这也彻底回答了 Go 的问题：`plc4x` 里 8.4% 的 Go 是**上游代码**，openIndu 从未修改，不构成任何编制需求。

取而代之的是一条**策略**（写进守则或 `inspector` 巡检维度，不占编制）：

| 场景                                 | 策略                                                           |
| ------------------------------------ | -------------------------------------------------------------- |
| fork 有本地补丁（`plc4x`）           | 由对应语言席位负责；`inspector` 定期报 `behind_by`，超阈值告警 |
| fork 无本地补丁（`openplc-runtime`） | 定期 fast-forward，或确认不再需要后归档                        |
| 新增 fork                            | 必须在 `route.json` 标 `upstream` 与 `delivery_owner`          |

> 教训：`fork` 席是在**没测偏离数据**时提的。一测就发现两个 fork 一个零改动、一个改动全在 C#——**编制不该建立在猜测上**。

#### 质量域（3 席）

| 席位       | 事实需求                                                       | 现状                          | 不设的代价                                |
| ---------- | -------------------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| `test`     | RULE 2 把「测试能支撑回归判断」列为 agent 准入的**阻断性**门槛 | 全组织无；platform 有但不共享 | RULE 2 的门槛没有任何人负责验证，形同虚设 |
| `reviewer` | RULE 5.2 要求每个 PR 覆盖正确性/安全性/可维护性/架构一致性     | 全组织无；platform 有但不共享 | 人类评审前没有预审，评审负担全压在人身上  |
| `security` | RULE 5.4 单独一节：最小权限、凭证不入 prompt、外部输入不可信   | 只是 inspector 的第 12 个维度 | 安全被降格成巡检的 1/13，没有专责         |

#### 交付链路域（1 席）

| 席位      | 事实需求                                                 | 现状                           | 不设的代价         |
| --------- | -------------------------------------------------------- | ------------------------------ | ------------------ |
| `release` | RULE 11 的 6 段链路：PR→合并→submodule→镜像→GitOps→apply | `infra-deploy`，**按仓库命名** | 链路断在哪没人兜底 |

> 重命名 `infra-deploy` → `release`：它的职责是**交付链路**，不是某个仓库。现名字把职责和仓库混为一谈，正是问题 ① 的典型。

#### 产品域（1 席）

| 席位      | 事实需求                           | 现状                     | 不设的代价                     |
| --------- | ---------------------------------- | ------------------------ | ------------------------------ |
| `product` | 需求分析、用户故事、API 契约与文档 | platform 有 3 个，不共享 | 需求侧完全靠人，且各仓做法不一 |

#### 数据域（1 席）

| 席位   | 事实需求                                                                             | 现状                           | 不设的代价                                  |
| ------ | ------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------- |
| `data` | RULE 10 **整条规则**都在讲生产 SQL 的防护（多列 WHERE / BEFORE-AFTER / 条件 commit） | 散在 `backend` 的第 3 条约束里 | 一整条 RULE 没有专责席位，靠 backend 顺手做 |

### 2.3 编制总览

**2026-08-04 用户拍板定稿**：采用完整编制而非精简方案；`web` 拆分；`python` 保持一席。

```
栈无关（按职责编制）
  治理域   manager      arbiter(收窄)   inspector
  规范域   control-tower
  质量域   test          reviewer       security
  链路域   release
  产品域   product
  数据域   data

按语言编制（交付域）
  web-vue      web-react     java     dotnet     python     rust
```

**16 席** = 栈无关 10 + 语言 6。相比现 7 席新增 10 个，重命名 1 个（`infra-deploy` → `release`），解散 1 个（`backend`/`frontend` 拆进语言席）。

| 域                          | 席位数 | 占比    |
| --------------------------- | ------ | ------- |
| 交付（语言）                | 6      | 38%     |
| 质量                        | 3      | 19%     |
| **交付+质量**               | **9**  | **56%** |
| 治理                        | 3      | 19%     |
| 其余（规范/链路/产品/数据） | 4      | 25%     |

治理占比从现状的 **57% 降到 19%**。

#### 三项拍板决策与依据

| 问题                   | 决策             | 依据                                                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| 完整编制 vs 精简 12 席 | **完整**         | 精简方案要缓的 `rust` 风险密度最高、`security` 对应 RULE 5.4 整节，缓任何一个都留下守则空缺 |
| `web` 拆不拆           | **拆**           | React 侧 151 文件 / Vue 侧 277 文件，两个量级相当的代码体；组件模型与状态管理范式完全不同   |
| `python` 是否够内聚    | **够，保持一席** | Web API / 采集器 / 工具链虽形态不同，但栈一致（同样的依赖管理、测试框架、lint 配置）        |

> **算术说明**：「15 席」是在「完整 vs 精简」之间选了完整；拆 `web` 使交付域 5→6，故最终为 **16 席**。

### 2.4 同时要做的三件小事

- **删掉架构树图**，改画运行时真实形态（flat fan-out + 文件聚合），或直接不画（问题 ④）
- **`frontend` 的「2 副本」从定义里移除**，改为 spawn 时的 `repo=` 参数（问题 ⑥）
- **每个 agent 定义补一节「本席负责的能力指标」**，与「可写文件清单」并列（问题 ⑦）

## 3. 影响范围

| 对象                                                   | 改动                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `plugins/openindu-workflow/agents/*.md`                | 7 个改写（去技术栈硬编码）+ 新增 7 个 = 13 个                |
| `plugins/openindu-workflow/reference/manifest.yaml`    | 重写编制、任务路由、升级规则                                 |
| `plugins/openindu-workflow/skills/*`                   | `/route` 增加「按 repo type 返回适用 agent」；`/launch` 更新 |
| `plugins/openindu-workflow/.claude-plugin/plugin.json` | version 1.0.0 → 2.0.0（破坏性：agent 改名）                  |
| `README.md` `team/README.md`                           | 编制表、架构图                                               |
| `reference/route.json`                                 | **新增 `modules` 层**：每个模块声明构建清单与语言（问题 ⑧）  |
| `scripts/`                                             | 新增模块探测脚本：扫构建清单自动生成 `modules`（RULE 3）     |

> **破坏性变更**：`backend` → 拆为 `java` / `python`、`frontend` → `web`、`infra-deploy` → `release`。已引用旧名的地方需同步。走 major 版本，下游 `/plugin update` 时会看到版本跳变。

## 4. 实施路径（HOW）

### 阶段 1 — 剥离实例耦合（不改名，不增席）

- 起点：现 7 席混着两类信息——**职责**（该保留）与**具体实例**（该剥离）
- 改动：从 agent 定义中移除具体仓库名、镜像地址、生产 IP、域名；**保留**框架与工具链知识（那是席位的专业价值，不是耦合）
- 验收：7 个定义里不再出现 `openIndu-*` 仓库名、`${OPENINDU_REGISTRY}` 镜像、`47.109.*` 生产 IP；框架名可以保留
- 回滚：revert PR。此阶段无破坏性，version 1.0.x

> 与初稿的区别：初稿要连框架名一起删，那是把专业深度也删掉了。要剥的是**实例**，不是**栈**。

### 阶段 2 — 补质量域（3 席，纯新增）

- 改动：新增 `test` / `reviewer` / `security`
- 理由：纯新增不破坏任何现有引用，且补的是 RULE 2 / 5.2 / 5.4 三条守则的空缺，收益最高
- 验收：三席可 `@openindu-workflow:` 调用；`inspector` 的安全维度移交 `security`
- 回滚：从 manifest 摘除即可，version 1.1.0

### 阶段 3 — 模块级路由（问题 ⑧ 的前置）

- 起点：`/route` 只能到仓库粒度，指不到 polyglot monorepo 里干活的单元
- 改动：写探测脚本扫构建清单（`pom.xml` / `package.json` / `pyproject.toml` / `Cargo.toml` / `*.csproj`）自动生成 `route.json` 的 `modules` 层；`/route` 支持按模块查询语言
- 验收：`/route openIndu-platform` 能列出 6 个子模块及各自语言
- **这一步必须先于阶段 4**——语言席位没有模块路由就不知道自己该管哪些目录
- 回滚：摘除 `modules` 字段，version 1.2.0

### 阶段 4 — 交付域按语言重建（破坏性）

- 改动：新增 `java` / `dotnet` / `rust`；`backend` 拆为 `python`（承接社区后端 + 采集器 + 转换器）；`frontend` → `web`（扩展至 Vue/UniApp）；`infra-deploy` → `release`；新增 `product` / `data`
- 用 `marketplace.json` 的 `renames` 字段平滑迁移已安装用户
- 验收：15 席齐全；每个模块的语言都有对应席位；旧名引用全部更新
- 回滚：revert + 保留 `renames` 反向映射，version 2.0.0

### 阶段 5 — arbiter 职责收窄

- 改动：manager 的标准通道不再默认过 arbiter；arbiter 只在三种场景介入
- 验收：巡检提案路径从 4 跳降到 2 跳
- 回滚：revert manifest 的 escalation_rules

## 5. 回滚方案

阶段 1-3 均为非破坏性，单独 revert 即可。阶段 4 依赖 `marketplace.json` 的 `renames` 做双向映射，回滚时保留反向条目，已安装用户不会失效。每阶段一个独立 PR。

## 6. 验收标准

| #   | 标准                                            | 验证方式                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | agent 定义中不含具体框架名 / 镜像地址 / 生产 IP | `grep -E 'FastAPI\|React\|Spring\|${OPENINDU_REGISTRY} agents/` 应无命中 |
| 2   | 每种 repo type 都有明确的 agent 归属            | 用 `/route` 遍历所有 type，逐一对照编制表                                |
| 3   | RULE 2 / 5.2 / 5.4 / 10 各有专责席位            | 编制表逐条对照                                                           |
| 4   | 每个 agent 定义含「本席负责的能力指标」一节     | 13 个文件逐一检查                                                        |
| 5   | 新增仓库不需要改任何 agent 定义                 | 在 `route.json` 加一条测试仓，确认无需改 `agents/`                       |
| 6   | 插件 schema 合法                                | `claude plugin validate --strict`                                        |

## 7. 守则自检（arbiter 审核前必填）

| 维度                    | 自检结论                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 守则遵守（11 条任一条） | ✅ 本 spec 补的正是 RULE 2 / 5.2 / 5.4 / 10 的空缺席位；模块探测用脚本而非 LLM（RULE 3）；RULE 3 的过度编排问题由阶段 5 处理                                              |
| 跨仓契约对齐            | ✅ 新增契约是 `route.json` 的 `modules` 层，由构建清单**程序化探测**生成，不依赖各仓手写声明——比初稿的「各仓 CLAUDE.md 自述技术栈」可靠得多                               |
| 与已定稿 spec 冲突      | ⚠️ 与 `spec/002` 有交叉：002 的 L3 保留清单（platform 的 test-engineer / reviewer）在本 spec 里成为**上收候选**。002 的阶段 2 应在本 spec 阶段 2 之后执行，否则会先删后建 |
| 最小改动                | ⚠️ 15 席相对 7 席是大幅扩编。已拆为 5 个阶段，每阶段独立 PR 且阶段 1-3 非破坏性；§2.3 给了 12 席的精简方案                                                                |
| 回滚路径                | ✅ 逐阶段可回滚；破坏性阶段用 `renames` 兜底                                                                                                                              |

## 8. 待解决问题

- [x] ~~15 席还是 12 席~~ —— **2026-08-04 用户拍板：完整编制**。精简方案要缓的 `rust` 风险密度最高、`security` 对应 RULE 5.4 整节，缓任何一个都留下守则空缺。叠加 `web` 拆分后为 **16 席**
- [x] ~~`web` 拆不拆~~ —— **2026-08-04 用户拍板：拆**。实测 React 侧 151 文件 / Vue 侧 277 文件，两个量级相当的代码体，组件模型与状态管理范式完全不同
- [x] ~~`python` 是否够内聚~~ —— **2026-08-04 用户拍板：够，保持一席**。三种形态栈一致（同样的依赖管理、测试框架、lint 配置）
- [x] ~~与 `spec/002` 的执行顺序~~ —— **2026-08-04 闭合**：002 的删除动作须在本 spec 阶段 2（质量域落地）之后执行，避免"先删后建"真空。platform 本地 L3 与新公共席的重叠属 002 §8「上收评估」范畴，需单开 spec 经 arbiter 审，不经 `/adopt` 删除。本轮（revision 2026-08-04-roster-cleanup-and-spec002-closure）在 platform 仅删 4 个 L1 重复（manager/arbiter/inspector/coordinator）+ L0 垃圾，L3 一律保留待 spec
- [x] ~~`openIndu-studio` 权威源待确认~~ —— **2026-08-04 用户确认：GitHub 是权威源**，Gitee 仅作镜像。已写入 `route.json` 的 `authoritative_host`
- [x] ~~两个 fork 的偏离程度未测~~ —— **2026-08-04 已量化**：`openplc-runtime` 零本地改动（ahead 0 / behind 41）；`plc4x` ahead 6 / behind 18，49 个改动文件**全是 .NET**。结论：**撤销 `fork` 席**，归 `dotnet`，改为一条策略
- [x] ~~platform 的 9 个本地 L3 agent 在新编制下如何定位~~ —— **2026-08-04 闭合**：4 个语言重叠 L3（`backend-developer`=Spring ↔ 公共 `java`、`frontend-developer`=Vue ↔ 公共 `web-vue`、`test-engineer` ↔ 公共 `test`、`reviewer` ↔ 公共 `reviewer`）走 spec/002 §8 上收评估——它们带 Python 脚本/模板，折叠=重写公共席，单开 spec；5 个非语言 L3（`architect` / `business-analyst` / `ops-engineer` / `product-manager` / `ui-ux-designer`）公共层无等价物，**保留**。platform 的 `openindu-manager`/`arbiter`/`inspector`/`coordinator` 4 个 L1 重复本轮删除
- [x] ~~`openindu-vision` 未扫到，可能引入第 6 席~~ —— **2026-08-03 查明：vision 是空仓**（创建后从未推送），视觉能力实际在 `openindu-station`。不引入新语言

## 9. 变更记录

| 日期       | 变更内容                                                                                                                                                                                                                                                                                                               | 关联 revision                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 2026-08-03 | 初始草稿                                                                                                                                                                                                                                                                                                               | —                                                     |
| 2026-08-04 | 方法论更正：普查改以 default branch 为准（此前扫的是 feature 分支）。Python 285（+29）、Rust main 上为 0（13 个 .rs 在未合并分支）；新增 `scripts/detect-modules.mjs`                                                                                                                                                  | 2026-08-04-roster-finalized.md                        |
| 2026-08-04 | **用户拍板定稿**：完整编制 + `web` 拆分 + `python` 保持一席 → **16 席**；status draft→finalized                                                                                                                                                                                                                        | 2026-08-04-roster-finalized.md                        |
| 2026-08-04 | 量化 fork 偏离后**撤销 `fork` 席**（16→15）：`openplc-runtime` 零本地改动、`plc4x` 补丁 100% 在 .NET 归 `dotnet`；确认 `openIndu-studio` 权威源为 GitHub                                                                                                                                                               | 2026-08-04-fork-divergence-and-studio-host.md         |
| 2026-08-03 | 补全组织普查：`route.json` 漏收 4 个仓（含最大代码体 `plc4x`）已补录 + CI 对账；查明 `openindu-vision` 是空仓、`openindu-station` 是漏掉的自研 C# 仓（`dotnet` 席位规模 110→290）；新增问题 ⑨ 与 `fork` 席，编制 15→16 席                                                                                              | 2026-08-04-complete-repo-census.md                    |
| 2026-08-03 | 交付域改为按语言编制（4 席栈无关 → 5 席按语言）；新增问题 ⑧（route.json 粒度是仓，但 platform 是 6 模块 5 语言的 monorepo）；纠正 §2.1「栈无关参数化」的错误设计                                                                                                                                                       | 2026-08-03-delivery-domain-by-stack.md                |
| 2026-08-04 | §8 两个 open item 闭合：与 spec/002 执行顺序（先上收再删，本轮仅删 L1 重复+L0 垃圾）；platform 9 个 L3 定位（4 重叠走 002 §8 上收 spec、5 非语言保留）                                                                                                                                                                 | 2026-08-04-roster-cleanup-and-spec002-closure.md      |
| 2026-08-04 | **反转 §2.1 的 6 语言席决策**：6 语言席→4 职位席（16→14），agent 剥离全部业务知识（具体仓/服务名），改纯职位+技能+技巧。依据是 §1.1 依赖倒置原则——大脑不应持有叶子仓/服务，业务绑定在 route.json + 各仓 CLAUDE.md。§2.1 否决的是"无栈知识空壳"，本模型保留栈知识只是多语言捆进职位 agent。新增 CI 业务知识防回流 guard | 2026-08-04-v3-position-named-roster-business-strip.md |
