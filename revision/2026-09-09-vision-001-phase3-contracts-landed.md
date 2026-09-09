---
date: 2026-09-09
slug: vision-001-phase3-contracts-landed
type: other
related_spec: vision-001-form-and-contracts # openIndu-vision-product 规划工作区，非 control-tower/spec/
author: 主会话（未分派 seat）
pr: openIndu/control-tower#8
---

# spec/vision-001 阶段 3（Vision.Contracts 抽取）已落地 + PublicApiAnalyzers 2 处方案偏差

## 变更摘要

`spec/vision-001-form-and-contracts.md` 阶段 3（`Vision.Contracts` 抽取，RULE 4 例外）已在
`openIndu/openIndu-vision` + `openIndu/openindu-station` 落地并 merge。7 个视觉契约类型
（`Calibration` / `CalibPoint` / `LocatorConfig` / `SimCameraConfig` / `CameraType` /
`CameraRole` / `CameraMount`）从 `OpenIndu.Station.Core` 移入 submodule 里新增的
`OpenIndu.Vision.Contracts`（`netstandard2.0`），命名空间统一 `OpenIndu.Vision.Contracts`。

本仓（control-tower）**无资产改动**，本条仅为 spec RULE 5 流程第 3 步「定稿后 / 落地后记入
`revision/`」的 changelog，并登记补偿控制 ⑤ 的 2 处方案偏差供 arbiter 知悉。

## 涉及 PR（不在本仓）

| PR                              | 状态                       | 内容                                                                                                                       |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `openIndu/openIndu-vision#1`    | MERGED（squash `ceed999`） | `Contracts` 程序集 + 7 类型（逐字节搬）+ shim `ProjectReference` + 9 消费文件 `using` + PublicApiAnalyzers                 |
| `openIndu/openIndu-vision#2`    | MERGED（squash `506da86`） | 本仓最小 CI `build.yml` + RULE 7 `.claude/settings.json` hook（此前本仓无任何配置）                                        |
| `openIndu/openindu-station#179` | 见 PR                      | 删 `Station.Core` 7 类型定义 + 25 文件 `using` + `CameraConfig.RecipeRef`（休眠字段）+ `.sln` + submodule 指针 `→ 506da86` |

## 触发原因

`spec/vision-001` §4 阶段 3 / §6 验收 #3–#8 / §3.5 RULE 4 例外（用户 2026-09-02 批准，
`05-decisions-locked.md` R-1）。RULE 4 例外本身已在 `revision/2026-09-03-route-vision-per-vision-001.md`
记录；本条记录**执行结果**与偏差。

## 补偿控制落地情况（spec §3.5）

| #   | 控制                                   | 落地                                                                                                                                |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ①   | 编译器强制（漏 `using` = CS0246）      | ✅ Debug + Release 双绿 = 34 处 `using` 全到位                                                                                      |
| ②   | Debug + Release 双绿是 gate            | ✅ 本地 + `openindu-station` CI 三 job（`vendor-branches` / `build` / `probes-debug`）                                              |
| ③   | 逐文件 `git diff` 审查                 | ✅ 25 站文件 + 9 submodule 文件全 `+1/−0`（仅 `using` 行）；7 类型体逐字节 == `openindu-station@6294719`（脚本 `verify_bodies.py`） |
| ④   | 抽取前受影响能力已有探针               | ✅ FR-0.4 探针 PR `openindu-station#177` 已先合（`36bb2bd`）                                                                        |
| ⑤   | 公开 API 面 gate（PublicApiAnalyzers） | ✅ 已落地，**但与方案 §6 有 2 处偏差（见下）**                                                                                      |

### 补偿控制 ⑤ 的 2 处偏差（供 arbiter 知悉）

`65-phase3-contracts-plan.md` §6 要求 **2-commit 法**给 shim 装 `PublicApiAnalyzers` +
`PublicAPI.Shipped.txt` 基线，使「shim 公开面只因 7 类型命名空间变化」成为机器可核的
构建门禁 diff。实际落地：

1. **1 个 commit 而非 2-commit 法**。根因：厂商 SDK 条件编译使 `HikCamera` 的公开面
   随 `HIK_SDK` 有无而变（无 SDK 桩 2 方法 / 有 SDK 7 方法）。pre-move 基线需在
   「装了厂商 SDK 的开发机」与「无 SDK 的 CI」两种环境各生成一次才严格可比，
   2-commit 的「一眼看出只有命名空间变」证据不成立。改由 `verify_bodies.py` 的
   byte-identical + `PublicAPI.Shipped.txt` 里 7 契约类型的 FQN（reviewer 可 1:1 对回
   `Core.*` 原名）共同承担「零成员增删」证据。

2. **`HikCamera.cs` / `CognexCamera.cs` 顶部 `#pragma warning disable RS0016/RS0017`**。
   这俩类整个在 `#if HIK_SDK` / `#if COGNEX_SDK` 里，公开面本质是构建配置的函数，
   单份 `PublicAPI.Shipped.txt` 追踪它无意义。`HikRuntime` / `HalconRuntime` / `HalconTool`
   （桩与真签名一致）**仍在追踪内**。

**净效果**：`VisionService`（10 成员）/ `VisionResult`（16 字段）/ 核心 HAL / Tools /
`CalibrationFitter` / `CameraManager` 的公开面被机器门禁钉死（311 个符号），
spec §6 #8 的核心意图达成。

**建议**：arbiter 若认为厂商相机适配器也须纳入门禁，作阶段 4 的 follow-up
（届时 `HikCamera` / `CognexCamera` 桩补齐到与真实现同签名，公开面即配置无关，
移除 `#pragma`）。

预审报告：`openIndu-vision-product/67-phase3-prereview.md`（v2.0）。

## 影响评估

| 影响范围               | 说明                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 哪些 repo agent 受影响 | `station-control`（阶段 4 内核程序集）；`architect`（`.oivn` schema v1，草案见 `openIndu-vision-product/68-oivn-schema-v1.md`，待单独一轮 arbiter）                                       |
| 是否需要下游同步       | 否（control-tower 资产未变）                                                                                                                                                              |
| 回滚方法               | `openindu-station#179` `git revert` 整个 squash commit（gitlink 退回 `7f9bb045`、7 类型回 `Station.Core`、`using` 回退，一次性）；`openIndu-vision` `main` 上 `Contracts` commit 保留无害 |

## 验证记录

- [x] `openindu-station` Debug + Release 双构建 0 错 / 22 警告（= 阶段 2 基线）/ RS00xx 零
- [x] `openindu-station` 探针 Debug + Release 各 835 过 / 0 挂（零回归）
- [x] `openindu-station` CI 三 job 全绿
- [ ] arbiter 知悉补偿控制 ⑤ 的 2 处偏差（本条 changelog 提交后）
- [x] 下游无需同步（control-tower 资产未变）
