# Revision — 修订记录（changelog）

本目录是 openIndu 社区管控层资产变更的 changelog（**HOW + WHEN**），与 [`../spec/`](../spec/) 一一对应：

- `spec/` 描述设计与决策（WHAT + WHY）
- `revision/` 描述每次实际修订（HOW + WHEN）

## 命名约定

```
YYYY-MM-DD-brief-slug.md
```

示例：

```
2026-06-25-init-openindu-control-tower.md
2026-07-15-add-rule12-data-retention.md
```

## 什么内容值得记 revision

| 类型                                    | 是否需要 revision               |
| --------------------------------------- | ------------------------------- |
| `principle.md` 任一条 RULE 变更         | **必须**                        |
| 新增 / 修改 / 删除 agent                | **必须**                        |
| `route.json` 仓库新增 / 迁移            | **必须**                        |
| `manifest.yaml` 升级规则 / 任务路由变更 | **必须**                        |
| spec 定稿                               | 自动（spec 状态变更不必单独记） |
| spec 修订（revision_required 退回）     | 否（spec 内变更记录字段记）     |
| agent 行为约束新增 / 调整               | **必须**                        |
| 文档错别字 / 格式                       | 否                              |

## 工作流

```
control-tower / 其他 agent 完成一次资产修订
        │
        ▼
按 TEMPLATE.md 写入 revision/YYYY-MM-DD-brief-slug.md
   · 描述改了什么、为什么改、对应 spec id（如有）
        │
        ▼
连同代码一起 commit（同一个 PR 中）
        │
        ▼
PR 标题 / 正文引用 revision slug
```

## 索引

| 日期       | 标题                                                                                                                                                               | 关联 spec                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 2026-06-25 | [init: openIndu workflow-control-tower 仓库初始化](./2026-06-25-init-openindu-control-tower.md)                                                                    | —                                                                                                   |
| 2026-07-01 | [2026-07-01 — route.json 新增四条产品线](./2026-07-01-add-product-lines.md)                                                                                        | —                                                                                                   |
| 2026-08-03 | [删除仓库全景（依赖倒置）+ Agent 组织架构评审](./2026-08-03-decouple-repo-panorama.md)                                                                             | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-03 | [交付域改为按语言编制；修正「栈无关参数化」的错误设计](./2026-08-03-delivery-domain-by-stack.md)                                                                   | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-03 | [建立公共插件 openindu-workflow，守则与治理 agent 收敛为单一来源](./2026-08-03-shared-plugin-distribution.md)                                                      | [001-shared-plugin-distribution](../spec/001-shared-plugin-distribution.md)                         |
| 2026-08-04 | [补全组织仓库普查：route.json 漏收 4 个仓，含组织内最大代码体](./2026-08-04-complete-repo-census.md)                                                               | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [量化 fork 偏离后撤销 `fork` 席；确认 studio 权威源为 GitHub](./2026-08-04-fork-divergence-and-studio-host.md)                                                     | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [Rename: workflow-control-tower → control-tower; plugin openindu-workflow → openindu-control-tower](./2026-08-04-rename-to-control-tower.md)                       | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [role 字段 + /launch 语言感知选人 + codebase-analysis 上收进插件](./2026-08-04-role-aware-roster-and-skill-consolidation.md)                                       | [002-agent-consolidation](../spec/002-agent-consolidation.md)                                       |
| 2026-08-04 | [stage-4 改名残留清理 + spec/002/003 执行顺序闭合](./2026-08-04-roster-cleanup-and-spec002-closure.md)                                                             | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [编制定稿 16 席；落地质量域 3 席；普查方法论更正](./2026-08-04-roster-finalized.md)                                                                                | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [阶段 4 完成：16 席全部落地（v2.0.0 破坏性变更）](./2026-08-04-stage-4-language-seats.md)                                                                          | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [v3.0.0：6 语言席→4 职位席 + 剥离业务知识（依赖倒置修正）](./2026-08-04-v3-position-named-roster-business-strip.md)                                                | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [v4.0.0: 20-seat SDLC role pipeline + agent-facing English](./2026-08-04-v4-sdlc-roster.md)                                                                        | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-04 | [v5.0.0: tiered autonomy + self-verify + memory + DESIGN.md (selective ECC/awesome-design-md adoption)](./2026-08-04-v5-autonomy.md)                               | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-05 | [`/build` skill 与生产实际对齐；route.json 修正 studio 归属](./2026-08-05-build-skill-matches-production.md)                                                       | —                                                                                                   |
| 2026-08-11 | [移除已删除的 openindu-vision 条目，并修正两处与 route.json 冲突的 release_flow 表述](./2026-08-11-drop-deleted-vision-repo.md)                                    | [003-agent-org-design](../spec/003-agent-org-design.md)                                             |
| 2026-08-25 | [RULE 7 hook 改为按 token 锚定 git 子命令，消除误报；并把 hook 测试接进 CI](./2026-08-25-hook-token-anchored-push-detection.md)                                    | —                                                                                                   |
| 2026-08-25 | [收录 openIndu-vision / openIndu-cim，并让组织覆盖检查说清自己的可见范围](./2026-08-25-route-vision-and-cim.md)                                                    | —                                                                                                   |
| 2026-08-29 | [Detach Studio from the Website aggregate route](./2026-08-29-detach-studio-route.md)                                                                              | —                                                                                                   |
| 2026-09-03 | [route.json openIndu-vision 重写为「源码 / 仅 submodule，依 spec/vision-001」，并记录 spec/vision-001 的 RULE 4 例外](./2026-09-03-route-vision-per-vision-001.md) | vision-001-form-and-contracts（非本仓 spec）                                                        |
| 2026-09-09 | [spec/vision-001 阶段 3（Vision.Contracts 抽取）已落地 + PublicApiAnalyzers 2 处方案偏差](./2026-09-09-vision-001-phase3-contracts-landed.md)                      | vision-001-form-and-contracts（非本仓 spec）                                                        |
| 2026-09-20 | [Organization-wide Issue intake and delivery pipeline](./2026-09-20-organization-issue-pipeline.md)                                                                | —                                                                                                   |
| 2026-10-18 | [Route: vision, cim and controller follow the lowercase rename; remaining repo-name prose](./2026-10-18-lowercase-remaining-repo-names.md)                         | —                                                                                                   |
| 2026-10-18 | [Route: follow the GitHub rename of six repos to all-lowercase names](./2026-10-18-lowercase-repo-names-in-route.md)                                               | —                                                                                                   |
| 2026-10-18 | [Principle: the example repo names in RULE 7 and RULE 10 follow the lowercase rename](./2026-10-18-principle-lowercase-example-names.md)                           | [004-principle-example-repo-names-lowercase](../spec/004-principle-example-repo-names-lowercase.md) |
| 2026-10-28 | [Principle: add the SA-1 standing-authorization clause to RULE 5.2](./2026-10-28-standing-authorization-sa1-clause.md)                                             | [006-standing-merge-authorization](../spec/006-standing-merge-authorization.md)                     |
| 2026-10-29 | [engine: terminal states, exit codes, and issue collection's --repo scope (spec/005 stage 4, PR-C1)](./2026-10-29-dev-engine-c1-states-and-issue-collection.md)    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: route/grant live-read and admission A1-A3 (spec/005 stage 4, PR-C2/4)](./2026-10-29-dev-engine-c2-route-admission.md)                                     | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: CI status classification and guards G1/G2/G3/G5/G6 (spec/005 stage 4, PR-C3)](./2026-10-29-dev-engine-c3-ci-status-guards.md)                             | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: protected paths and test-integrity detection, guard G4 (spec/005 stage 4, PR-C3b)](./2026-10-29-dev-engine-c3b-protected-paths-test-integrity.md)         | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: .dev-pause primitive and CODEOWNERS parsing (spec/005 stage 4, PR-C4a)](./2026-10-29-dev-engine-c4a-pause-codeowners.md)                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: guards G7-G11 (spec/005 stage 4, PR-C4b)](./2026-10-29-dev-engine-c4b-guards-g7-g11.md)                                                                   | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine: circuit breaker, ./dev ack, log redaction, ci.yml wiring (spec/005 stage 4, PR-C4c)](./2026-10-29-dev-engine-c4c-circuit-breaker-ack-redaction-ci.md)     | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine/carrier: network-isolated Docker sandbox + 7 positive controls (spec/005 stage 5, PR-D1)](./2026-10-29-dev-engine-d1-carrier.md)                           | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine/carrier/invoker.mjs: headless invocation argv builder (spec/005 stage 5, PR-D2)](./2026-10-29-dev-engine-d2-invoker.md)                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine/review-panel.mjs: complexity-scaled tier selection (spec/005 stage 5, PR-D3a)](./2026-10-29-dev-engine-d3a-review-panel.md)                                | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [engine/plan-solidification.mjs: deterministic scoring + solution doc (spec/005 stage 5, PR-D3b)](./2026-10-29-dev-engine-d3b-plan-solidification.md)              | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [evals/dev-reasoning-layer: reasoning-layer eval suite skeleton (spec/005 stage 5, PR-D3c)](./2026-10-29-dev-engine-d3c-reasoning-eval-skeleton.md)                | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-29 | [route: add the /dev data contract (dev.schema.json) and fix openindu-studio's stale entry](./2026-10-29-dev-schema-and-studio-route-fix.md)                       | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [evals/dev-reasoning-layer: first real baseline run (spec/005 stage 5, criterion #11)](./2026-10-30-dev-engine-d3c-baseline-run.md)                                | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/worktree.mjs + engine/git-ops.mjs (spec/005 stage 6, PR-E1)](./2026-10-30-dev-engine-e1-worktree-git-ops.md)                                               | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/run-state.mjs (spec/005 stage 6, PR-E2)](./2026-10-30-dev-engine-e2-run-state.md)                                                                          | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/pr-lifecycle.mjs (spec/005 stage 6, PR-E3)](./2026-10-30-dev-engine-e3-pr-lifecycle.md)                                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/merge-execute.mjs (spec/005 stage 6, PR-E4) — stage 6 complete](./2026-10-30-dev-engine-e4-merge-execute.md)                                               | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/carrier/run-agent.mjs (spec/005 stage 7, PR-F1)](./2026-10-30-dev-engine-f1-run-agent.md)                                                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/issue-intake.mjs (spec/005 stage 7, PR-F2)](./2026-10-30-dev-engine-f2-issue-intake.md)                                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/proposal-review.mjs (spec/005 stage 7, PR-F3)](./2026-10-30-dev-engine-f3-proposal-review.md)                                                              | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/implement-review.mjs (spec/005 stage 7, PR-F4)](./2026-10-30-dev-engine-f4-implement-review.md)                                                            | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/pr-and-merge.mjs (spec/005 stage 7, PR-F5)](./2026-10-30-dev-engine-f5-pr-and-merge.md)                                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/local-service.mjs (spec/005 stage 7, PR-F6)](./2026-10-30-dev-engine-f6-local-service.md)                                                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/build-step.mjs (spec/005 stage 7, PR-F7)](./2026-10-30-dev-engine-f7-build-step.md)                                                                        | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [skills/dev/scripts/dev.mjs (spec/005 stage 7, PR-F8-1)](./2026-10-30-dev-engine-f8-1-dev-entry-skeleton.md)                                                       | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/carrier-callbacks.mjs (spec/005 stage 7, PR-F8-2)](./2026-10-30-dev-engine-f8-2-carrier-callbacks.md)                                                      | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/tier-resolution.mjs (spec/005 stage 7, PR-F8-3)](./2026-10-30-dev-engine-f8-3-tier-resolution.md)                                                          | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/merge-facts.mjs (spec/005 stage 7, PR-F8-4)](./2026-10-30-dev-engine-f8-4-merge-facts.md)                                                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/carrier-callbacks.mjs extensions (spec/005 stage 7, PR-F8-5)](./2026-10-30-dev-engine-f8-5-implement-fix-review.md)                                        | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/step4-callbacks.mjs (spec/005 stage 7, PR-F8-6)](./2026-10-30-dev-engine-f8-6-step4-callbacks.md)                                                          | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/carrier-callbacks.mjs: buildRealSummarizeAcceptanceCriteria (spec/005 stage 7, PR-F8-7)](./2026-10-30-dev-engine-f8-7-verify-checklist-callback.md)        | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-30 | [engine/issue-pipeline.mjs: runIssuePipeline (spec/005 stage 7, PR-F8-8)](./2026-10-30-dev-engine-f8-8-issue-pipeline.md)                                          | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-23: wire ./dev ack and ./dev build subcommand dispatch](./2026-10-31-dev-engine-ack-build-subcommands.md)                                                      | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-19: wrap carrier callbacks with budget tracking and trace logging](./2026-10-31-dev-engine-budget-trace.md)                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-15: carrier-setup -- run-level system prompt and callback wiring](./2026-10-31-dev-engine-carrier-setup.md)                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-20: implement --dry-run as a real stop-after-step-2 mode](./2026-10-31-dev-engine-dry-run.md)                                                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Four pipeline-infra gaps closed before final assembly (spec/005 stage 7, PR-F8-10)](./2026-10-31-dev-engine-f8-10-pipeline-infra-gaps.md)                         | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Redacted trace persistence + degradation/human-correction/rollback rates (spec/005 stage 7, PR-F8-11)](./2026-10-31-dev-engine-f8-11-trace-and-rates.md)          | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Proposal self-declares its touched paths, for guardG4 (spec/005 stage 7, PR-F8-12)](./2026-10-31-dev-engine-f8-12-declared-paths.md)                              | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [engine/budget-tracking.mjs + costUsd propagation (spec/005 stage 7, PR-F8-9)](./2026-10-31-dev-engine-f8-9-budget-tracking.md)                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Fix: ANTHROPIC_API_KEY was never wired into the real carrier invocation](./2026-10-31-dev-engine-fix-anthropic-api-key-wiring.md)                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Fix: a CI-fix retry round never actually committed or pushed](./2026-10-31-dev-engine-fix-ci-retry-never-commits.md)                                              | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [Fix: declaredPaths/scoping were dropped before reaching step 4](./2026-10-31-dev-engine-fix-declaredpaths-scoping-passthrough.md)                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-13: sourcing guardG9/guardG10's last two unresolved fields](./2026-10-31-dev-engine-g9-g10-fact-sources.md)                                                    | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-22: wire step 5 (local verification) and step 6 readiness into the run report](./2026-10-31-dev-engine-local-verify-build-readiness.md)                        | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-14: buildRealStep4Deps -- the real buildStep4Deps adapter](./2026-10-31-dev-engine-real-step4-deps.md)                                                         | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-16: run-context -- repo-level runContext fields resolved once per run](./2026-10-31-dev-engine-run-context.md)                                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-17: runRepo -- real per-issue loop wiring steps 2-4 end to end](./2026-10-31-dev-engine-run-loop.md)                                                           | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-21: render the final run report (spec/005 section 6 criteria #15/#16)](./2026-10-31-dev-engine-run-report.md)                                                  | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-18: wire run-state persistence, the run lock, and --resume into runRepo](./2026-10-31-dev-engine-run-state.md)                                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-24: add the /dev skill definition](./2026-10-31-dev-skill-definition.md)                                                                                       | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-10-31 | [F8-25: wire isolation positive controls into the real run path](./2026-10-31-wire-isolation-positive-controls.md)                                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-11-02 | [spec 文件夹自查：协调 003 编制结论、收口 001/002 待办、回填 revision 索引](./2026-11-02-roster-and-backlog-reconciliation.md)                                     | [007-roster-and-backlog-reconciliation](../spec/007-roster-and-backlog-reconciliation.md)           |
| 2026-11-02 | [F8-26: wire the 72-hour ack downgrade into the real run path](./2026-11-02-wire-ack-downgrade.md)                                                                 | [005-org-dev-workflow](../spec/005-org-dev-workflow.md)                                             |
| 2026-11-02 | [把 RULE 4 规模上限 / 测试完整性 / 受保护路径可见性拆成独立 CI 检查](./2026-11-02-pr-scope-ci-guard.md)                                                            | —                                                                                                   |
