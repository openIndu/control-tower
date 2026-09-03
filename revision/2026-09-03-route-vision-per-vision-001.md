---
date: 2026-09-03
slug: route-vision-per-vision-001
type: route
related_spec: vision-001-form-and-contracts # lives in the openIndu-vision-product planning workspace, not control-tower/spec/
author: control-tower (vision-ct seat)
pr: openIndu/control-tower#7
---

# route.json openIndu-vision 重写为「源码 / 仅 submodule，依 spec/vision-001」，并记录 spec/vision-001 的 RULE 4 例外

## Summary

`openIndu-vision-product/spec/vision-001-form-and-contracts.md` 经 arbiter 第 2 轮
`pass_with_conditions` 并 `finalized`（评审文 `vision-001-arbiter-review.md` §R2）。本次
在 control-tower 落地它对本仓两项资产的影响：

1. **route.json 的 `openIndu-vision` 条目整条重写**（spec PC-4 / §6 验收 #11）。现有条目
   把「已挂成 openindu-station 的 submodule」写成既成事实——实测不成立：
   `src/OpenIndu.Station.Vision` 在 `openindu-station/main` 上仍是普通目录，`main` 上没有
   `.gitmodules`，`openindu-station#173`（会把它重挂为 submodule 的 PR）未合并且已分叉。
   独立仓 `openIndu-vision` 现有内容（`7491063a`）是 2026-08-25 一次 subtree split 留下的
   **孤儿快照**，无任何消费者、且缺 `openindu-station` `a1b8d85` 的 CognexCamera 修复。
   重写后：`status: active`、`release_flow` 写成「源码 / 仅 submodule」+ 指向 spec、
   「内核可独立 `dotnet build`」标为**目标非事实**、独立 CLI/IDE 分发明确出 vision-001 范围。

2. **记录 spec/vision-001 的 RULE 4 例外**（spec §3.5 / PC-3）。`Vision.Contracts` 抽取 PR
   与内核迁移 PR 均远超 RULE 4「≤400 行 / ≤1 模块边界」上限、且原子不可切，用户 2026-09-02
   明确批准例外（`05-decisions-locked.md` R-1），与 control-tower `spec/001` 阶段 1 的
   RULE 4 例外先例一致。落地由 station-control 席位在 `openindu-station` 仓执行；本仓只留
   这条 changelog（spec RULE 5 流程第 3 步「记入 `revision/`」）。

顺带把 `/route` 与 `/delivery-check` 里同样把 vision 说成「已是 submodule / 不能独立构建」
的 prose 校正为「计划中、源码仍在父仓 in-tree」。

## 依据（`/principle` spec 修改流程第 3 步「定稿后记入 `revision/`」）

- **spec**：`openIndu-vision-product/spec/vision-001-form-and-contracts.md`（`status: finalized`）
- **finalize 事件**：arbiter **第 2 轮 `pass_with_conditions`**，2026-09-02，评审文
  `openIndu-vision-product/spec/vision-001-arbiter-review.md` **§R2**
  - §R2.1 —— R-1…R-7 全部闭合
  - §R2.5 —— PC-4（本条 route.json 变更）定稿措辞 + PC-1/2/3 状态；明确「control-tower
    席位机械落地、**不需再评审轮**」
  - §R2.4 —— spec 转 `finalized` 的收尾编辑清单（已由 team-lead 应用）
- **本文件** = 该流程第 3 步的产物（一并覆盖 spec §3.5 的 RULE 4 例外 / PC-3，用户 2026-09-02
  批准，见下）。

## 变更

| 文件                                                            | 变更                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/openindu-control-tower/reference/route.json`           | 唯一源。`openIndu-vision` 条目整条重写（新增 `status: active`，重写 `release_flow` + `description`）。其余条目不动                                            |
| `route.json`                                                    | 由 `node scripts/sync-route.mjs` 从唯一源重新生成                                                                                                             |
| `plugins/openindu-control-tower/skills/route/SKILL.md`          | 全景图 vision 节点标「planned submodule」；Known data issues 两行把 vision 的「已是 submodule / 不能独立构建」校正为「计划中、in-tree、spec/vision-001 跟踪」 |
| `plugins/openindu-control-tower/skills/delivery-check/SKILL.md` | 适用范围表 vision/cim 行加「(planned; sources still in-tree)」；prettier 重排该表列宽                                                                         |
| `plugins/openindu-control-tower/.claude-plugin/plugin.json`     | 5.3.1 → **5.3.2**（改了 plugin 内容，不 bump 下游 `/plugin update` 取不到）                                                                                   |
| `.claude-plugin/marketplace.json`                               | 5.3.1 → **5.3.2**                                                                                                                                             |
| `revision/2026-09-03-route-vision-per-vision-001.md`            | 本文件（新增）                                                                                                                                                |

## RULE 4 例外（spec/vision-001 §3.5）

**范围**：`openindu-station` 仓内两个 PR——

- `Vision.Contracts` 抽取 PR：7 个类型从 `Station.Core` 移入新 `netstandard2.0` 程序集，
  ~32 个源文件 + ~4 个探针文件改 `using`，跨 Core / Vision / Motion / Platform /
  App.Dispense / App.LaserCut / tests **7 个模块边界**，`Station.Core.csproj` +1
  `ProjectReference`，`CameraConfig` 加一个向后兼容的 `recipeRef` 可选字段。
- 内核迁移 PR：现有 16 个 `.cs` 大部分 `git mv` 进 `Vision.Core`。

两者本质原子——`using` 迁移不完整就编不过，无法形式化切成 400 行以内的可编译分片。

**批准**：用户 2026-09-02 明确批准（`05-decisions-locked.md` R-1）。与 `spec/001` 阶段 1
「新建独立目录树，按阶段拆分后每仓 PR 仍超上限」的 RULE 4 例外先例一致
（见 `revision/2026-08-03-shared-plugin-distribution.md` / `spec/001` §7）。

**补偿控制（5 条，例外的对价）**：

| #   | 控制                        | 保证方式                                                                                              |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| ①   | 编译器强制                  | 漏一个 `using` → 直接编译红，不是静默失败                                                             |
| ②   | Debug + Release 双绿是 gate | CI 门禁，两个配置都过才能合                                                                           |
| ③   | 逐文件 `git diff` 审查      | 人工确认每个文件 `using` 行以外零逻辑变更；`git mv` 的文件确认内容 byte-identical                     |
| ④   | 抽取前受影响能力已有探针    | FR-0.4 探针在抽取 PR **之前**独立进阻塞 CI 集（不与「补探针」同 PR）                                  |
| ⑤   | 公开 API 面 gate            | `Microsoft.CodeAnalysis.PublicApiAnalyzers`（`PublicAPI.Shipped.txt`）钉死 `VisionService` 完整公开面 |

**落地位置**：`openindu-station` 仓，station-control 席位。本仓不产代码，只留此 changelog。

## route.json `openIndu-vision` 条目：改了什么、为什么

### Before（PR #2 / 2026-08-25 e8ba9b9 起）

```jsonc
"release_flow": "submodule — mounted into openindu-station at src/OpenIndu.Station.Vision.
  Produces no container image ... Does NOT build standalone: the csproj reaches Core
  through a relative path that only resolves inside the parent checkout.",
"description": "Vision subsystem, split out of openindu-station on 2026-08-25 with its
  own history preserved (git subtree split, 10 commits). ..."
```

问题（实测依据 `openIndu-vision-product/60-phase0-repo-state-and-plan.md`，2026-09-02
`git fetch` + 逐文件内容比对）：

- **把未发生的 submodule 挂载写成既成事实。** `src/OpenIndu.Station.Vision` 在
  `openindu-station/main` 上是 `040000 tree`（目录），`main` 无 `.gitmodules`；
  `openindu-station#173` 未合并、已与 `main` 分叉 3 个 commit。此条目与同文件里
  `openindu-station` 条目（仍列 8 个 modules + `pending_split`）自相矛盾。
- **`Does NOT build standalone` 写成永久事实。** spec/vision-001 的核心产出就是抽
  `Vision.Contracts` 切断这条相对路径依赖、让内核可独立 `dotnet build`。应写成**目标**。
- **description 的「2026-08-25 split ... 10 commits」误导。** 那次 split 产出的独立仓
  `7491063a` 是无消费者的孤儿，且已缺 `a1b8d85`。spec/vision-001（A2）是基于当前
  `openindu-station/main` **重新干净提取、只抽 vision、不 merge #173**。

### After

```jsonc
"status": "active",
"release_flow": "source / submodule-only, per openIndu-vision-product/spec/vision-001-form-and-contracts.md.
  The vision code still lives in-tree at openindu-station/src/OpenIndu.Station.Vision ...
  openindu-station#173 ... is unmerged and superseded for vision by spec/vision-001 ...
  RULE 11 ends at the parent's submodule-pointer PR ... Goal per spec/vision-001, not yet
  true: the kernel builds standalone under `dotnet build` once the Vision.Contracts
  extraction severs the relative-path dependency on OpenIndu.Station.Core. Standalone
  CLI / IDE distribution is out of scope for vision-001 — a future spec covers it
  (see spec/vision-001 §4.7).",
"description": "Vision subsystem: camera HAL ... This repo's current content (7491063a)
  is a stale 2026-08-25 subtree-split snapshot — no consumer, missing openindu-station
  a1b8d85's CognexCamera fix; spec/vision-001's clean re-extraction resets it."
```

保留：`aggregate: openindu-station`、`mount_path`、`delivery_owner: station-control`、
`primary_language: csharp`、`modules: ["."]`、camelCase key/url（PR #2 已归一）。
JSON 键沿用既有约定，未新造字段（spec pointer 放 `release_flow` prose，不加新键）。

一并纠正 `60-phase0` H2（该项按 5.2.1 旧插件缓存描述条目为 `placeholder / empty`——
本仓实际自 PR #2 起已非 placeholder，本次重写把剩余的「过早 submodule」表述也修掉）。

## 关于 arbiter §R2.5 与本仓实际条目的偏差（已知，已按仓内实际落地）

arbiter 评审 §R2.5 与 `60-phase0` H2 都把「当前条目」描述为
`type: placeholder / status: empty / primary_language: null / "never pushed, size=0"`，
并称第 1 轮「`Does NOT build standalone` 在条目里」是转述错误。

实测：那份描述对应的是**已过时的 5.2.1 插件缓存**
（`~/.claude/plugins/cache/openindu/openindu-control-tower/5.2.1/reference/route.json`，
早于 2026-08-11）。本仓 `main` 上的条目自 **PR #2（e8ba9b9，2026-08-25）** 起已经是
camelCase + `type: vision` + `primary_language: csharp` + 含 `Does NOT build standalone`
的完整条目——即第 1 轮评审的原始描述其实是对的。

因此本次按 team-lead 指令「以仓内实际为准」落地：目标事实清单（§R2.5 所列 8 点）全部
达成，但起点不是「空占位」而是「过早写成 submodule 的完整条目」。差异不影响终态。

## 未改动（scope / RULE 6）

- **`openindu-station` 条目 + `pending_split` 字段**：仍写「#173 合并后删两条 modules」。
  A2 已定「不 merge #173」，此字段措辞随之过时，但**属父仓条目、不在 PC-4 范围**，
  留给后续（宜与 CIM 席位的 scan 提取一起处理）。
- **`openIndu-cim` 条目**：A2 明确「本 spec 不触及 cim」。未动。
- **`spec/003-agent-org-design.md` 及 `revision/` 下历史记录**中对 vision 的提及：
  RULE 6，历史设计/变更记录不改。
- **既有的 `detect-modules.mjs --check` 失败**：`node scripts/detect-modules.mjs --check`
  在**干净的 `origin/main` 上已经失败**（`openIndu-cim` 实际有 5 个 `.csproj` 模块，
  route.json 仍写 `modules: ["."]`）。与本次改动无关、且属 cim 范围。CI 里该步用
  `secrets.GITHUB_TOKEN`（看不到私有仓），是否在 CI 触发红灯取决于 token 可见性。
  已单独提示 team-lead。

## Verification

- [x] `node scripts/sync-route.mjs` — 唯一源 → 仓库根同步完成
- [x] `node scripts/sync-route.mjs --check` — 两份一致
- [x] `node -e JSON.parse(...)` — route.json ×2 / plugin.json / marketplace.json 均可解析
- [x] `npx prettier --check "**/*.md"` — 全绿（delivery-check 表已 `--write` 重排）
- [x] `npx claude plugin validate ./plugins/openindu-control-tower --strict` — 通过
- [x] `node scripts/check-roster.mjs` — 20 席不变
- [x] `node plugins/openindu-control-tower/hooks/block-push-main.test.mjs` — hook 测试全过
- [x] arbiter 评审 — **第 2 轮 `pass_with_conditions`**（`vision-001-arbiter-review.md` §R2，
      2026-09-02）；PC-4 措辞见 §R2.5，定性为「control-tower 机械落地、不需再评审轮」——
      本 PR 不再触发新一轮 arbiter
- [~] `node scripts/detect-modules.mjs --check` — 失败项为 `openIndu-cim`（pre-existing，
  见「未改动」），与本 PR 无关

## Impact

| Scope      | Note                                                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Downstream | patch 5.3.1 → 5.3.2；`/route` 与 `/delivery-check` 对 `openIndu-vision` 的判定由「已是 submodule / 不能独立构建」更正为「计划中、依 spec/vision-001」                                                                                                     |
| 行为       | 纯路由数据 + 文档校正，无逻辑变更。RULE 11 对 vision 的适用步骤（①②③，止于父仓指针 PR）未变——那是**挂载后**的交付模型                                                                                                                                     |
| Rollback   | `git revert` 本 PR 的 commit + `node scripts/sync-route.mjs`；下游可 `/plugin install @5.3.1`                                                                                                                                                             |
| 待办       | ① `openindu-station.pending_split` 措辞随 A2「不 merge #173」过时，待后续（宜合 CIM 席位处理）；② `openIndu-cim` 的 `modules` 与实际 5 模块不符（pre-existing）；③ station-control 在 `openindu-station` 仓落地 RULE 4 例外的两个 PR + 5 条补偿控制逐条勾 |
